import * as v from "valibot"
import * as z from "zod"
import kernMetadata from "../../packages/kern/package.json"
import { array, number, object, string } from "../../packages/kern/src/validation/index.js"
import valibotMetadata from "../node_modules/valibot/package.json"
import zodMetadata from "../node_modules/zod/package.json"
import { type BenchmarkCase, type BenchmarkDefinition, invariant } from "./harness.js"

const kernVersion = kernMetadata.version
const zodVersion = zodMetadata.version
const valibotVersion = valibotMetadata.version

const fieldCount = 25

const kernLabel = string().min(2)
const zodLabel = z.string().min(2)
const valibotLabel = v.pipe(v.string(), v.minLength(2))

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

const kernWideShape: Record<string, ReturnType<typeof string>> = {}
const zodWideShape: Record<string, z.ZodString> = {}
const valibotWideField = v.pipe(v.string(), v.minLength(1))
const valibotWideShape: Record<string, typeof valibotWideField> = {}
const wideInput: Record<string, string> = {}
const invalidWideInput: Record<string, string> = {}
for (let index = 0; index < fieldCount; index += 1) {
  const key = `field${index}`
  kernWideShape[key] = string().min(1)
  zodWideShape[key] = z.string().min(1)
  valibotWideShape[key] = v.pipe(v.string(), v.minLength(1))
  wideInput[key] = `value${index}`
  invalidWideInput[key] = ""
}
const kernWide = object(kernWideShape)
const zodWide = z.object(zodWideShape)
const valibotWide = v.object(valibotWideShape)

const kernDefaults = object({
  name: string(),
  nickname: string().optional(),
  role: string().default("member"),
})
const zodDefaults = z.object({
  name: z.string(),
  nickname: z.string().optional(),
  role: z.string().default("member"),
})
const valibotDefaults = v.object({
  name: v.string(),
  nickname: v.optional(v.string()),
  role: v.optional(v.string(), "member"),
})

const kernPipeline = string()
  .trim()
  .min(3)
  .refine((value) => value.startsWith("a"))
  .transform((value) => value.toUpperCase())
const zodPipeline = z
  .string()
  .trim()
  .min(3)
  .refine((value) => value.startsWith("a"))
  .transform((value) => value.toUpperCase())
const valibotPipeline = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(3),
  v.check((value) => value.startsWith("a")),
  v.transform((value) => value.toUpperCase()),
)

const validUser = { name: "Ada Lovelace", email: "ada@example.com", age: 36 }
const oneIssueUser = { name: "Ada Lovelace", email: "not-an-email", age: 36 }
const invalidUser = { name: "A", email: "not-an-email", age: 12 }
const nestedInput = { account: { profile: validUser } }
const invalidNestedInput = { account: { profile: invalidUser } }
const defaultInput = { name: "Ada" }
const stripInput: Record<string, unknown> = { ...validUser }
for (let index = 0; index < fieldCount; index += 1) stripInput[`unknown${index}`] = index

const arraySizes = [1, 10, 100, 1_000] as const
const denseFailureSizes = [1, 10, 100] as const
const validArrays = new Map<number, readonly (typeof validUser)[]>()
const sparseInvalidArrays = new Map<number, readonly (typeof validUser)[]>()
const denseInvalidArrays = new Map<number, readonly (typeof invalidUser)[]>()
for (const size of arraySizes) {
  const valid = Array.from({ length: size }, (_, index) => ({
    age: 18 + (index % 50),
    email: `user${index}@example.com`,
    name: `User ${index}`,
  }))
  const sparseInvalid = valid.slice()
  sparseInvalid[size - 1] = invalidUser
  validArrays.set(size, valid)
  sparseInvalidArrays.set(size, sparseInvalid)
  if (denseFailureSizes.includes(size as (typeof denseFailureSizes)[number])) {
    denseInvalidArrays.set(
      size,
      Array.from({ length: size }, () => invalidUser),
    )
  }
}
const abortEarlyInput = Array.from({ length: 1_000 }, () => invalidUser)

const variedSchemaCount = 32
const kernVariedSchemas: ReturnType<typeof object>[] = []
const zodVariedSchemas: z.ZodObject<Record<string, z.ZodType>>[] = []
const valibotVariedSchemas: ReturnType<typeof v.object>[] = []
const variedInputs: Record<string, unknown>[] = []
for (let index = 0; index < variedSchemaCount; index += 1) {
  const name = `name${index}`
  const email = `email${index}`
  const age = `age${index}`
  kernVariedSchemas.push(
    object({ [name]: string().min(2), [email]: string().email(), [age]: number().integer() }),
  )
  zodVariedSchemas.push(
    z.object({ [name]: z.string().min(2), [email]: z.email(), [age]: z.number().int() }),
  )
  valibotVariedSchemas.push(
    v.object({
      [name]: v.pipe(v.string(), v.minLength(2)),
      [email]: v.pipe(v.string(), v.email()),
      [age]: v.pipe(v.number(), v.integer()),
    }),
  )
  variedInputs.push({ [name]: "Ada", [email]: `ada${index}@example.com`, [age]: 36 })
}
let variedIndex = 0

const mapValue = <T>(values: ReadonlyMap<number, T>, size: number, name: string): T => {
  const value = values.get(size)
  invariant(value !== undefined, `${name} fixture for ${size} items must exist`)
  return value
}

const verifyParsedUser = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "parse must return an object")
  invariant("email" in result && result.email === validUser.email, "parse must retain the email")
}

const verifySafeParseSuccess = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "safeParse must return a result")
  invariant("success" in result && result.success === true, "safeParse must succeed")
}

const verifyParsedNested = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "nested parse must return an object")
  invariant("account" in result && typeof result.account === "object", "account must be parsed")
}

const verifyParsedArray = (result: unknown, expected: number): void => {
  invariant(
    Array.isArray(result) && result.length === expected,
    `array must return ${expected} users`,
  )
}

const verifyWideObject = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "wide parse must return an object")
  invariant(
    Object.keys(result).length === fieldCount,
    `wide parse must return ${fieldCount} fields`,
  )
}

const verifyStrippedObject = (result: unknown): void => {
  verifyParsedUser(result)
  invariant(typeof result === "object" && result !== null, "stripped parse must return an object")
  invariant(Object.keys(result).length === 3, "default object parsing must strip unknown keys")
}

const verifyDefaults = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "default parse must return an object")
  invariant("role" in result && result.role === "member", "default parse must add the role")
  invariant(!("nickname" in result), "missing optional property must remain absent")
}

const verifyPipeline = (result: unknown): void => {
  invariant(result === "ADA", "pipeline must trim, refine, and transform the value")
}

const verifyStandardSuccess = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "Standard Schema must return a result")
  invariant("value" in result, "Standard Schema success must contain value")
}

const verifyConstructedSchema = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "schema construction must return schema")
  invariant("parse" in result || "~run" in result, "constructed value must expose schema behavior")
}

const verifyVariedObject = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "varied parse must return an object")
  invariant(Object.keys(result).length === 3, "varied parse must retain three fields")
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

interface ValidationAdapter {
  readonly abortEarly?: (input: unknown) => unknown
  readonly constructUser: () => unknown
  readonly library: "Kern" | "Valibot" | "Zod"
  readonly parseDefaults: () => unknown
  readonly parseLabel: (input: unknown) => unknown
  readonly parseNested: (input: unknown) => unknown
  readonly parsePipeline: (input: unknown) => unknown
  readonly parseStrip: () => unknown
  readonly parseUser: (input: unknown) => unknown
  readonly parseUsers: (input: unknown) => unknown
  readonly parseVaried: () => unknown
  readonly parseWide: (input: unknown) => unknown
  readonly safeParseLabel: (input: unknown) => unknown
  readonly safeParseNested: (input: unknown) => unknown
  readonly safeParsePipeline: (input: unknown) => unknown
  readonly safeParseUser: (input: unknown) => unknown
  readonly safeParseUsers: (input: unknown) => unknown
  readonly safeParseWide: (input: unknown) => unknown
  readonly standardUser: (input: unknown) => unknown
  readonly verifyIssues: (result: unknown, expected: number) => void
  readonly version: string
}

const adapters: readonly ValidationAdapter[] = [
  {
    abortEarly: (input) => kernUsers.safeParse(input, { abortEarly: true }),
    constructUser: () =>
      object({
        name: string().min(2),
        email: string().email(),
        age: number().integer().min(18),
      }),
    library: "Kern",
    parseDefaults: () => kernDefaults.parse(defaultInput),
    parseLabel: (input) => kernLabel.parse(input),
    parseNested: (input) => kernNested.parse(input),
    parsePipeline: (input) => kernPipeline.parse(input),
    parseStrip: () => kernUser.parse(stripInput),
    parseUser: (input) => kernUser.parse(input),
    parseUsers: (input) => kernUsers.parse(input),
    parseVaried: () => {
      const index = variedIndex++ % variedSchemaCount
      return kernVariedSchemas[index]?.parse(variedInputs[index])
    },
    parseWide: (input) => kernWide.parse(input),
    safeParseLabel: (input) => kernLabel.safeParse(input),
    safeParseNested: (input) => kernNested.safeParse(input),
    safeParsePipeline: (input) => kernPipeline.safeParse(input),
    safeParseUser: (input) => kernUser.safeParse(input),
    safeParseUsers: (input) => kernUsers.safeParse(input),
    safeParseWide: (input) => kernWide.safeParse(input),
    standardUser: (input) => kernUser["~standard"].validate(input),
    verifyIssues: verifyKernIssues,
    version: kernVersion,
  },
  {
    constructUser: () =>
      z.object({
        name: z.string().min(2),
        email: z.email(),
        age: z.number().int().min(18),
      }),
    library: "Zod",
    parseDefaults: () => zodDefaults.parse(defaultInput),
    parseLabel: (input) => zodLabel.parse(input),
    parseNested: (input) => zodNested.parse(input),
    parsePipeline: (input) => zodPipeline.parse(input),
    parseStrip: () => zodUser.parse(stripInput),
    parseUser: (input) => zodUser.parse(input),
    parseUsers: (input) => zodUsers.parse(input),
    parseVaried: () => {
      const index = variedIndex++ % variedSchemaCount
      return zodVariedSchemas[index]?.parse(variedInputs[index])
    },
    parseWide: (input) => zodWide.parse(input),
    safeParseLabel: (input) => zodLabel.safeParse(input),
    safeParseNested: (input) => zodNested.safeParse(input),
    safeParsePipeline: (input) => zodPipeline.safeParse(input),
    safeParseUser: (input) => zodUser.safeParse(input),
    safeParseUsers: (input) => zodUsers.safeParse(input),
    safeParseWide: (input) => zodWide.safeParse(input),
    standardUser: (input) => zodUser["~standard"].validate(input),
    verifyIssues: verifyZodIssues,
    version: zodVersion,
  },
  {
    abortEarly: (input) => v.safeParse(valibotUsers, input, { abortEarly: true }),
    constructUser: () =>
      v.object({
        name: v.pipe(v.string(), v.minLength(2)),
        email: v.pipe(v.string(), v.email()),
        age: v.pipe(v.number(), v.integer(), v.minValue(18)),
      }),
    library: "Valibot",
    parseDefaults: () => v.parse(valibotDefaults, defaultInput),
    parseLabel: (input) => v.parse(valibotLabel, input),
    parseNested: (input) => v.parse(valibotNested, input),
    parsePipeline: (input) => v.parse(valibotPipeline, input),
    parseStrip: () => v.parse(valibotUser, stripInput),
    parseUser: (input) => v.parse(valibotUser, input),
    parseUsers: (input) => v.parse(valibotUsers, input),
    parseVaried: () => {
      const index = variedIndex++ % variedSchemaCount
      return v.parse(
        valibotVariedSchemas[index] as ReturnType<typeof v.object>,
        variedInputs[index],
      )
    },
    parseWide: (input) => v.parse(valibotWide, input),
    safeParseLabel: (input) => v.safeParse(valibotLabel, input),
    safeParseNested: (input) => v.safeParse(valibotNested, input),
    safeParsePipeline: (input) => v.safeParse(valibotPipeline, input),
    safeParseUser: (input) => v.safeParse(valibotUser, input),
    safeParseUsers: (input) => v.safeParse(valibotUsers, input),
    safeParseWide: (input) => v.safeParse(valibotWide, input),
    standardUser: (input) => valibotUser["~standard"].validate(input),
    verifyIssues: verifyValibotIssues,
    version: valibotVersion,
  },
]

interface ScenarioOptions {
  readonly itemsPerOperation?: number
  readonly size?: number
  readonly unit?: string
}

interface ScenarioExecution {
  readonly run: () => unknown
  readonly verify: (result: unknown) => void
}

const benchmark = (
  adapter: ValidationAdapter,
  category: string,
  name: string,
  run: () => unknown,
  verify: (result: unknown) => void,
  options: ScenarioOptions = {},
): BenchmarkCase => ({
  category,
  library: adapter.library,
  libraryVersion: adapter.version,
  name,
  run,
  suite: "validation-compare",
  verify,
  ...options,
})

const forEveryAdapter = (
  category: string,
  name: string,
  create: (adapter: ValidationAdapter) => ScenarioExecution,
  options: ScenarioOptions = {},
): readonly BenchmarkCase[] =>
  adapters.map((adapter) => {
    const definition = create(adapter)
    return benchmark(adapter, category, name, definition.run, definition.verify, options)
  })

const fixedBenchmarks: readonly BenchmarkCase[] = [
  ...forEveryAdapter(
    "schema construction",
    "construct constrained 3-field object schema",
    (adapter) => ({
      run: adapter.constructUser,
      verify: verifyConstructedSchema,
    }),
  ),
  ...forEveryAdapter("primitive", "parse constrained string", (adapter) => ({
    run: () => adapter.parseLabel("Ada"),
    verify: (result) => invariant(result === "Ada", "string parse must return its input"),
  })),
  ...forEveryAdapter("primitive", "reject constrained string", (adapter) => ({
    run: () => adapter.safeParseLabel("A"),
    verify: (result) => adapter.verifyIssues(result, 1),
  })),
  ...forEveryAdapter(
    "object",
    "parse valid 3-field object",
    (adapter) => ({
      run: () => adapter.parseUser(validUser),
      verify: verifyParsedUser,
    }),
    { size: 3, itemsPerOperation: 3, unit: "fields" },
  ),
  ...forEveryAdapter("interoperability", "Standard Schema valid 3-field object", (adapter) => ({
    run: () => adapter.standardUser(validUser),
    verify: verifyStandardSuccess,
  })),
  ...forEveryAdapter(
    "varied shapes",
    "parse rotating 32-schema 3-field objects",
    (adapter) => ({
      run: adapter.parseVaried,
      verify: verifyVariedObject,
    }),
    { size: variedSchemaCount, unit: "schemas" },
  ),
  ...forEveryAdapter(
    "object",
    "safeParse valid 3-field object",
    (adapter) => ({
      run: () => adapter.safeParseUser(validUser),
      verify: verifySafeParseSuccess,
    }),
    { size: 3, itemsPerOperation: 3, unit: "fields" },
  ),
  ...forEveryAdapter(
    "object",
    "reject object with 1 issue",
    (adapter) => ({
      run: () => adapter.safeParseUser(oneIssueUser),
      verify: (result) => adapter.verifyIssues(result, 1),
    }),
    { size: 1, unit: "issue" },
  ),
  ...forEveryAdapter(
    "object",
    "reject object with 3 issues",
    (adapter) => ({
      run: () => adapter.safeParseUser(invalidUser),
      verify: (result) => adapter.verifyIssues(result, 3),
    }),
    { size: 3, unit: "issues" },
  ),
  ...forEveryAdapter(
    "nested",
    "parse valid depth-3 object",
    (adapter) => ({
      run: () => adapter.parseNested(nestedInput),
      verify: verifyParsedNested,
    }),
    { size: 3, unit: "levels" },
  ),
  ...forEveryAdapter(
    "nested",
    "reject depth-3 object with 3 issues",
    (adapter) => ({
      run: () => adapter.safeParseNested(invalidNestedInput),
      verify: (result) => adapter.verifyIssues(result, 3),
    }),
    { size: 3, unit: "issues" },
  ),
  ...forEveryAdapter(
    "wide object",
    "parse valid 25-field object",
    (adapter) => ({
      run: () => adapter.parseWide(wideInput),
      verify: verifyWideObject,
    }),
    { size: fieldCount, itemsPerOperation: fieldCount, unit: "fields" },
  ),
  ...forEveryAdapter(
    "wide object",
    "reject 25-field object with 25 issues",
    (adapter) => ({
      run: () => adapter.safeParseWide(invalidWideInput),
      verify: (result) => adapter.verifyIssues(result, fieldCount),
    }),
    { size: fieldCount, itemsPerOperation: fieldCount, unit: "issues" },
  ),
  ...forEveryAdapter(
    "object behavior",
    "strip 25 unknown keys",
    (adapter) => ({
      run: adapter.parseStrip,
      verify: verifyStrippedObject,
    }),
    { size: fieldCount, unit: "unknown keys" },
  ),
  ...forEveryAdapter("object behavior", "apply default and omit optional", (adapter) => ({
    run: adapter.parseDefaults,
    verify: verifyDefaults,
  })),
  ...forEveryAdapter("pipeline", "trim, refine, and transform success", (adapter) => ({
    run: () => adapter.parsePipeline("  ada  "),
    verify: verifyPipeline,
  })),
  ...forEveryAdapter(
    "pipeline",
    "refinement failure",
    (adapter) => ({
      run: () => adapter.safeParsePipeline("bob"),
      verify: (result) => adapter.verifyIssues(result, 1),
    }),
    { size: 1, unit: "issue" },
  ),
]

const validArrayBenchmarks = arraySizes.flatMap((size) => {
  const input = mapValue(validArrays, size, "valid array")
  return forEveryAdapter(
    "array success",
    `parse ${size}-item valid array`,
    (adapter) => ({
      run: () => adapter.parseUsers(input),
      verify: (result) => verifyParsedArray(result, size),
    }),
    { itemsPerOperation: size, size, unit: "users" },
  )
})

const sparseFailureBenchmarks = arraySizes.flatMap((size) => {
  const input = mapValue(sparseInvalidArrays, size, "sparse invalid array")
  return forEveryAdapter(
    "array failure",
    `reject ${size}-item array, invalid item last`,
    (adapter) => ({
      run: () => adapter.safeParseUsers(input),
      verify: (result) => adapter.verifyIssues(result, 3),
    }),
    { itemsPerOperation: size, size, unit: "users" },
  )
})

const denseFailureBenchmarks = denseFailureSizes.flatMap((size) => {
  const input = mapValue(denseInvalidArrays, size, "dense invalid array")
  const issueCount = size * 3
  return forEveryAdapter(
    "issue aggregation",
    `reject ${size}-item array with ${issueCount} issues`,
    (adapter) => ({
      run: () => adapter.safeParseUsers(input),
      verify: (result) => adapter.verifyIssues(result, issueCount),
    }),
    { itemsPerOperation: size, size, unit: "users" },
  )
})

const abortEarlyBenchmarks: readonly BenchmarkDefinition[] = adapters.map((adapter) => {
  if (!adapter.abortEarly) {
    return {
      category: "early abort",
      library: adapter.library,
      libraryVersion: adapter.version,
      name: "abort on first issue in 1,000 invalid items",
      size: 1_000,
      suite: "validation-compare",
      unit: "input users",
      unsupported: "no parse-level abortEarly option",
    }
  }
  return benchmark(
    adapter,
    "early abort",
    "abort on first issue in 1,000 invalid items",
    () => adapter.abortEarly?.(abortEarlyInput),
    (result) => adapter.verifyIssues(result, 1),
    { size: 1_000, unit: "input users" },
  )
})

export const validationComparisonBenchmarks: readonly BenchmarkDefinition[] = [
  ...fixedBenchmarks,
  ...validArrayBenchmarks,
  ...sparseFailureBenchmarks,
  ...denseFailureBenchmarks,
  ...abortEarlyBenchmarks,
]
