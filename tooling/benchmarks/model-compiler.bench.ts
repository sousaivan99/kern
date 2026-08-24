import kernMetadata from "../../packages/kern/package.json"
import { compileModels } from "../model-compiler/compiler.js"
import {
  AdvancedUser,
  User,
  UserBatch,
  Wide10,
  Wide100,
  Wide1000,
} from "../model-compiler/generated/models.js"
import {
  AdvancedUser as AdvancedUserSource,
  UserBatch as UserBatchSource,
  User as UserSource,
  Wide10 as Wide10Source,
  Wide100 as Wide100Source,
  Wide1000 as Wide1000Source,
} from "../model-compiler/models.js"
import { type BenchmarkCase, invariant } from "./harness.js"

const validUser = { age: 36, email: " ada@example.com ", username: " ada " }
const invalidUser = { age: 12, email: "wrong", username: "a" }
const oneFailureUser = { ...validUser, email: "wrong" }
const wideInputUser: Record<string, unknown> = { ...validUser }
for (let index = 0; index < 10_000; index += 1) wideInputUser[`unknown${index}`] = index

const validAdvancedUser = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  preferences: {},
  profile: {
    address: {
      city: " London ",
      countryCode: "GB",
      postalCode: "NW1",
      street: " 1 Analytical Engine Way ",
    },
    biography: " Programmer ",
    displayName: " Ada Lovelace ",
  },
  roles: ["admin", "author", "reviewer"],
  score: 99.5,
}
const invalidAdvancedUser = structuredClone(validAdvancedUser)
invalidAdvancedUser.profile.address.city = " "
invalidAdvancedUser.roles[2] = ""

const batchInputs = new Map<number, { readonly requestId: string; readonly users: unknown[] }>()
const invalidBatchInputs = new Map<
  number,
  { readonly requestId: string; readonly users: unknown[] }
>()
for (const size of [1, 10, 100, 1_000]) {
  const users = Array.from({ length: size }, (_, index) => ({
    age: 18 + (index % 90),
    email: `person${index}@example.com`,
    username: `person${index}`,
  }))
  batchInputs.set(size, {
    requestId: "123e4567-e89b-42d3-a456-426614174000",
    users,
  })
  const invalidUsers = users.slice()
  invalidUsers[size - 1] = {
    age: 18 + ((size - 1) % 90),
    email: "wrong",
    username: `person${size - 1}`,
  }
  invalidBatchInputs.set(size, {
    requestId: "123e4567-e89b-42d3-a456-426614174000",
    users: invalidUsers,
  })
}

const wideInputs = new Map<number, Record<string, unknown>>()
const invalidWideInputs = new Map<number, Record<string, unknown>>()
for (const size of [10, 100, 1_000]) {
  const valid: Record<string, unknown> = {}
  for (let index = 0; index < size; index += 1) valid[`field${index}`] = index
  wideInputs.set(size, valid)
  invalidWideInputs.set(size, { ...valid, [`field${size - 1}`]: 0.5 })
}

const fromMap = <T>(values: ReadonlyMap<number, T>, size: number): T => {
  const value = values.get(size)
  invariant(value !== undefined, `fixture for size ${size} must exist`)
  return value
}

const verifyParseSuccess = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "parse must return an object")
}

const verifySafeSuccess = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "safeParse must return a result")
  invariant("success" in result && result.success === true, "safeParse must succeed")
}

const verifySafeFailure = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "safeParse must return a result")
  invariant("success" in result && result.success === false, "safeParse must fail")
  invariant("issues" in result && Array.isArray(result.issues), "failure must contain issues")
}

interface ComparisonOptions {
  readonly itemsPerOperation?: number
  readonly name: string
  readonly runCompiled: () => unknown
  readonly runRuntime: () => unknown
  readonly size?: number
  readonly unit?: string
  readonly verify: (result: unknown) => void
}

const comparison = (options: ComparisonOptions): readonly BenchmarkCase[] => [
  {
    name: options.name,
    run: options.runRuntime,
    verify: options.verify,
    suite: "model-compiler",
    library: "Kern runtime",
    libraryVersion: kernMetadata.version,
    ...(options.itemsPerOperation === undefined
      ? {}
      : { itemsPerOperation: options.itemsPerOperation }),
    ...(options.size === undefined ? {} : { size: options.size }),
    ...(options.unit === undefined ? {} : { unit: options.unit }),
  },
  {
    name: options.name,
    run: options.runCompiled,
    verify: options.verify,
    suite: "model-compiler",
    library: "Kern compiled",
    libraryVersion: "0.0.0-experiment",
    ...(options.itemsPerOperation === undefined
      ? {}
      : { itemsPerOperation: options.itemsPerOperation }),
    ...(options.size === undefined ? {} : { size: options.size }),
    ...(options.unit === undefined ? {} : { unit: options.unit }),
  },
]

const batchBenchmarks = [1, 10, 100, 1_000].flatMap((size) => {
  const valid = fromMap(batchInputs, size)
  const invalid = fromMap(invalidBatchInputs, size)
  return [
    ...comparison({
      itemsPerOperation: size,
      name: "user batch parse success",
      runCompiled: () => UserBatch.parse(valid),
      runRuntime: () => UserBatchSource.parse(valid),
      size,
      unit: "users",
      verify: verifyParseSuccess,
    }),
    ...comparison({
      itemsPerOperation: size,
      name: "user batch failure at end",
      runCompiled: () => UserBatch.safeParse(invalid),
      runRuntime: () => UserBatchSource.safeParse(invalid),
      size,
      unit: "users",
      verify: verifySafeFailure,
    }),
  ]
})

const wideModels = [
  [10, Wide10Source, Wide10],
  [100, Wide100Source, Wide100],
  [1_000, Wide1000Source, Wide1000],
] as const
const wideBenchmarks = wideModels.flatMap(([size, runtime, compiled]) => {
  const valid = fromMap(wideInputs, size)
  const invalid = fromMap(invalidWideInputs, size)
  return [
    ...comparison({
      itemsPerOperation: size,
      name: "wide object parse success",
      runCompiled: () => compiled.parse(valid),
      runRuntime: () => runtime.parse(valid),
      size,
      unit: "fields",
      verify: verifyParseSuccess,
    }),
    ...comparison({
      itemsPerOperation: size,
      name: "wide object failure at end",
      runCompiled: () => compiled.safeParse(invalid),
      runRuntime: () => runtime.safeParse(invalid),
      size,
      unit: "fields",
      verify: verifySafeFailure,
    }),
  ]
})

export const modelCompilerBenchmarks: readonly BenchmarkCase[] = [
  ...comparison({
    name: "beginner User parse success",
    runCompiled: () => User.parse(validUser),
    runRuntime: () => UserSource.parse(validUser),
    verify: verifyParseSuccess,
  }),
  ...comparison({
    name: "beginner User safeParse success",
    runCompiled: () => User.safeParse(validUser),
    runRuntime: () => UserSource.safeParse(validUser),
    verify: verifySafeSuccess,
  }),
  ...comparison({
    name: "beginner User one failure",
    runCompiled: () => User.safeParse(oneFailureUser),
    runRuntime: () => UserSource.safeParse(oneFailureUser),
    verify: verifySafeFailure,
  }),
  ...comparison({
    name: "beginner User three failures",
    runCompiled: () => User.safeParse(invalidUser),
    runRuntime: () => UserSource.safeParse(invalidUser),
    verify: verifySafeFailure,
  }),
  ...comparison({
    name: "beginner User strips 10,000 unknown keys",
    runCompiled: () => User.parse(wideInputUser),
    runRuntime: () => UserSource.parse(wideInputUser),
    size: 10_003,
    unit: "input keys",
    verify: verifyParseSuccess,
  }),
  ...comparison({
    name: "advanced nested parse success",
    runCompiled: () => AdvancedUser.parse(validAdvancedUser),
    runRuntime: () => AdvancedUserSource.parse(validAdvancedUser),
    verify: verifyParseSuccess,
  }),
  ...comparison({
    name: "advanced nested safeParse success",
    runCompiled: () => AdvancedUser.safeParse(validAdvancedUser),
    runRuntime: () => AdvancedUserSource.safeParse(validAdvancedUser),
    verify: verifySafeSuccess,
  }),
  ...comparison({
    name: "advanced nested two failures",
    runCompiled: () => AdvancedUser.safeParse(invalidAdvancedUser),
    runRuntime: () => AdvancedUserSource.safeParse(invalidAdvancedUser),
    verify: verifySafeFailure,
  }),
  ...batchBenchmarks,
  ...wideBenchmarks,
]

const generationCase = (
  name: string,
  exportName: string,
  definition: unknown,
  size: number,
): BenchmarkCase => ({
  name,
  library: "Kern compiler",
  libraryVersion: "0.0.0-experiment",
  run: () =>
    compileModels(
      { [exportName]: definition },
      { runtimeImport: "../runtime.js", sourceImport: "../models.js" },
    ),
  size,
  suite: "model-compiler-generation",
  unit: "fields",
  verify: (result) => {
    invariant(typeof result === "object" && result !== null, "compiler must return artifacts")
    invariant("validatorSources" in result, "compiler must generate validator source")
  },
})

export const modelCompilerGenerationBenchmarks: readonly BenchmarkCase[] = [
  generationCase("generate beginner User artifacts", "User", UserSource, 3),
  generationCase("generate 10-field model artifacts", "Wide10", Wide10Source, 10),
  generationCase("generate 100-field model artifacts", "Wide100", Wide100Source, 100),
  generationCase("generate 1,000-field model artifacts", "Wide1000", Wide1000Source, 1_000),
]
