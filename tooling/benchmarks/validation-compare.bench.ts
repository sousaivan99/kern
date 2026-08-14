import * as v from "valibot"
import * as z from "zod"
import { array, number, object, string } from "../../packages/kern/src/validation/index.js"
import { type BenchmarkCase, type BenchmarkDefinition, invariant } from "./harness.js"

const readVersion = async (url: URL): Promise<string> => {
  const metadata: unknown = await Bun.file(url).json()
  invariant(typeof metadata === "object" && metadata !== null, `${url} must contain metadata`)
  invariant("version" in metadata && typeof metadata.version === "string", `${url} needs a version`)
  return metadata.version
}

const [kernVersion, zodVersion, valibotVersion] = await Promise.all([
  readVersion(new URL("../../packages/kern/package.json", import.meta.url)),
  readVersion(new URL("../node_modules/zod/package.json", import.meta.url)),
  readVersion(new URL("../node_modules/valibot/package.json", import.meta.url)),
])

const kernUser = object({
  name: string().min(2),
  email: string().email(),
  age: number().integer().min(18),
})
const zodUser = z.object({
  name: z.string().min(2),
  email: z.email(),
  age: z.number().int().min(18),
})
const valibotUser = v.object({
  name: v.pipe(v.string(), v.minLength(2)),
  email: v.pipe(v.string(), v.email()),
  age: v.pipe(v.number(), v.integer(), v.minValue(18)),
})

const kernNested = object({ account: object({ profile: kernUser }) })
const zodNested = z.object({ account: z.object({ profile: zodUser }) })
const valibotNested = v.object({ account: v.object({ profile: valibotUser }) })
const kernUsers = array(kernUser)
const zodUsers = z.array(zodUser)
const valibotUsers = v.array(valibotUser)

const validUser = { name: "Ada Lovelace", email: "ada@example.com", age: 36 }
const invalidUser = { name: "A", email: "not-an-email", age: 12 }
const nestedInput = { account: { profile: validUser } }
const validUsers = Array.from({ length: 100 }, (_, index) => ({
  age: 18 + (index % 50),
  email: `user${index}@example.com`,
  name: `User ${index}`,
}))
const invalidUsers = Array.from({ length: 100 }, () => invalidUser)

const verifyParsedUser = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "parse must return an object")
  invariant("email" in result && result.email === validUser.email, "parse must retain the email")
}

const verifyParsedNested = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "nested parse must return an object")
  invariant("account" in result && typeof result.account === "object", "account must be parsed")
}

const verifyParsedArray = (result: unknown): void => {
  invariant(Array.isArray(result) && result.length === 100, "array parse must return 100 users")
}

const verifyKernIssues = (result: unknown, expected: number): void => {
  invariant(typeof result === "object" && result !== null, "Kern safeParse must return a result")
  invariant("success" in result && result.success === false, "Kern validation must fail")
  invariant("issues" in result && Array.isArray(result.issues), "Kern failure must contain issues")
  if ("issues" in result && Array.isArray(result.issues)) {
    invariant(result.issues.length === expected, `Kern must return ${expected} issue(s)`)
  }
}

const verifyZodIssues = (result: unknown, expected: number): void => {
  invariant(typeof result === "object" && result !== null, "Zod safeParse must return a result")
  invariant("success" in result && result.success === false, "Zod validation must fail")
  invariant("error" in result && result.error instanceof z.ZodError, "Zod must return ZodError")
  if ("error" in result && result.error instanceof z.ZodError) {
    invariant(result.error.issues.length === expected, `Zod must return ${expected} issue(s)`)
  }
}

const verifyValibotIssues = (result: unknown, expected: number): void => {
  invariant(typeof result === "object" && result !== null, "Valibot safeParse must return a result")
  invariant("success" in result && result.success === false, "Valibot validation must fail")
  invariant("issues" in result && Array.isArray(result.issues), "Valibot failure needs issues")
  if ("issues" in result && Array.isArray(result.issues)) {
    invariant(result.issues.length === expected, `Valibot must return ${expected} issue(s)`)
  }
}

const benchmark = (
  library: string,
  libraryVersion: string,
  name: string,
  run: () => unknown,
  verify: (result: unknown) => void,
  itemsPerOperation?: number,
): BenchmarkCase => ({
  ...(itemsPerOperation === undefined ? {} : { itemsPerOperation }),
  library,
  libraryVersion,
  name,
  run,
  suite: "validation-compare",
  verify,
})

export const validationComparisonBenchmarks: readonly BenchmarkDefinition[] = [
  benchmark(
    "Kern",
    kernVersion,
    "parse valid object",
    () => kernUser.parse(validUser),
    verifyParsedUser,
  ),
  benchmark(
    "Zod",
    zodVersion,
    "parse valid object",
    () => zodUser.parse(validUser),
    verifyParsedUser,
  ),
  benchmark(
    "Valibot",
    valibotVersion,
    "parse valid object",
    () => v.parse(valibotUser, validUser),
    verifyParsedUser,
  ),
  benchmark(
    "Kern",
    kernVersion,
    "reject invalid object",
    () => kernUser.safeParse(invalidUser),
    (result) => verifyKernIssues(result, 3),
  ),
  benchmark(
    "Zod",
    zodVersion,
    "reject invalid object",
    () => zodUser.safeParse(invalidUser),
    (result) => verifyZodIssues(result, 3),
  ),
  benchmark(
    "Valibot",
    valibotVersion,
    "reject invalid object",
    () => v.safeParse(valibotUser, invalidUser),
    (result) => verifyValibotIssues(result, 3),
  ),
  benchmark(
    "Kern",
    kernVersion,
    "parse nested object",
    () => kernNested.parse(nestedInput),
    verifyParsedNested,
  ),
  benchmark(
    "Zod",
    zodVersion,
    "parse nested object",
    () => zodNested.parse(nestedInput),
    verifyParsedNested,
  ),
  benchmark(
    "Valibot",
    valibotVersion,
    "parse nested object",
    () => v.parse(valibotNested, nestedInput),
    verifyParsedNested,
  ),
  benchmark(
    "Kern",
    kernVersion,
    "validate 100-item array",
    () => kernUsers.parse(validUsers),
    verifyParsedArray,
    100,
  ),
  benchmark(
    "Zod",
    zodVersion,
    "validate 100-item array",
    () => zodUsers.parse(validUsers),
    verifyParsedArray,
    100,
  ),
  benchmark(
    "Valibot",
    valibotVersion,
    "validate 100-item array",
    () => v.parse(valibotUsers, validUsers),
    verifyParsedArray,
    100,
  ),
  benchmark(
    "Kern",
    kernVersion,
    "abort early on 100 invalid items",
    () => kernUsers.safeParse(invalidUsers, { abortEarly: true }),
    (result) => verifyKernIssues(result, 1),
  ),
  {
    library: "Zod",
    libraryVersion: zodVersion,
    name: "abort early on 100 invalid items",
    suite: "validation-compare",
    unsupported: "no parse-level abortEarly option",
  },
  benchmark(
    "Valibot",
    valibotVersion,
    "abort early on 100 invalid items",
    () => v.safeParse(valibotUsers, invalidUsers, { abortEarly: true }),
    (result) => verifyValibotIssues(result, 1),
  ),
]
