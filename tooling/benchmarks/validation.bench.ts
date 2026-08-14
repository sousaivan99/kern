import { array, number, object, record, string } from "../../packages/kern/src/validation/index.js"
import { type BenchmarkCase, invariant } from "./harness.js"

const sizes = [1_000, 10_000, 100_000] as const
const simpleSchema = object({ name: string().min(2), age: number().integer().min(18) })
const nestedSchema = object({
  user: object({
    name: string(),
    contacts: array(object({ email: string().email() })),
  }),
})
const integerArraySchema = array(number().integer())
const boundedFailureInput = Array.from({ length: 1_000 }, () => 0.5)
const composedSchema = simpleSchema
  .pick(["name", "age"])
  .extend({ active: number().integer() })
  .strict()
const passthroughSchema = simpleSchema.passthrough()

const verifySuccess = (result: unknown): void => {
  invariant(typeof result === "object" && result !== null, "safeParse must return a result")
  invariant("success" in result && result.success === true, "validation must succeed")
}

const verifyFailureCount = (result: unknown, expected: number): void => {
  invariant(typeof result === "object" && result !== null, "safeParse must return a result")
  invariant("success" in result && result.success === false, "validation must fail")
  invariant("issues" in result && Array.isArray(result.issues), "failure must contain issues")
  if ("issues" in result && Array.isArray(result.issues)) {
    invariant(result.issues.length === expected, `validation must return ${expected} issues`)
  }
}

const largeArrayBenchmarks = sizes.flatMap((size): BenchmarkCase[] => {
  const valid = Array.from({ length: size }, (_, index) => index)
  const finalFailure = valid.slice()
  finalFailure[size - 1] = 0.5
  return [
    {
      name: "array success",
      run: () => integerArraySchema.safeParse(valid),
      size,
      suite: "validation-kern",
      unit: "items",
      verify: verifySuccess,
    },
    {
      name: "array one failure at end",
      run: () => integerArraySchema.safeParse(finalFailure),
      size,
      suite: "validation-kern",
      unit: "items",
      verify: (result) => verifyFailureCount(result, 1),
    },
  ]
})

const wideInputBenchmarks = sizes.map((size): BenchmarkCase => {
  const input: Record<string, unknown> = { name: "Ada", age: 36 }
  for (let index = 2; index < size; index += 1) input[`unknown${index}`] = index
  return {
    itemsPerOperation: 2,
    name: "object 2-field schema, wide input",
    run: () => simpleSchema.safeParse(input),
    size,
    suite: "validation-kern",
    unit: "input keys",
    verify: (result) => {
      verifySuccess(result)
      if (!(typeof result === "object" && result !== null && "data" in result)) return
      invariant(
        typeof result.data === "object" &&
          result.data !== null &&
          Object.keys(result.data).length === 2,
        "object schema must strip unknown keys",
      )
    },
  }
})

const wideSchemaBenchmarks = [100, 1_000, 10_000].map((size): BenchmarkCase => {
  const shape: Record<string, ReturnType<typeof number>> = {}
  const input: Record<string, number> = {}
  for (let index = 0; index < size; index += 1) {
    shape[`key${index}`] = number().integer()
    input[`key${index}`] = index
  }
  const schema = object(shape)
  return {
    name: "object wide schema success",
    run: () => schema.safeParse(input),
    size,
    suite: "validation-kern",
    unit: "schema fields",
    verify: verifySuccess,
  }
})

const recordBenchmarks = sizes.map((size): BenchmarkCase => {
  const input: Record<string, number> = {}
  for (let index = 0; index < size; index += 1) input[`key${index}`] = index
  const schema = record(number().integer())
  return {
    name: "record success",
    run: () => schema.safeParse(input),
    size,
    suite: "validation-kern",
    unit: "entries",
    verify: verifySuccess,
  }
})

const allFailureBenchmarks = [1_000, 10_000].map((size): BenchmarkCase => {
  const input = Array.from({ length: size }, () => 0.5)
  return {
    name: "array all items fail",
    run: () => integerArraySchema.safeParse(input),
    size,
    suite: "validation-kern",
    unit: "issues",
    verify: (result) => verifyFailureCount(result, size),
  }
})

export const validationBenchmarks: readonly BenchmarkCase[] = [
  {
    name: "simple object parse",
    run: () => simpleSchema.parse({ name: "Ada", age: 36 }),
    suite: "validation-kern",
    verify: (result) => {
      invariant(typeof result === "object" && result !== null, "parse must return an object")
      invariant("name" in result && result.name === "Ada", "parse must retain validated data")
    },
  },
  {
    name: "nested object success",
    run: () =>
      nestedSchema.safeParse({
        user: { name: "Ada", contacts: [{ email: "ada@example.com" }] },
      }),
    suite: "validation-kern",
    verify: verifySuccess,
  },
  {
    name: "safeParse success",
    run: () => simpleSchema.safeParse({ name: "Ada", age: 36 }),
    suite: "validation-kern",
    verify: verifySuccess,
  },
  {
    name: "safeParse two failures",
    run: () => simpleSchema.safeParse({ name: "A", age: 12 }),
    suite: "validation-kern",
    verify: (result) => verifyFailureCount(result, 2),
  },
  {
    name: "composed strict object success",
    run: () => composedSchema.safeParse({ name: "Ada", age: 36, active: 1 }),
    suite: "validation-kern",
    verify: verifySuccess,
  },
  {
    name: "passthrough object success",
    run: () => passthroughSchema.safeParse({ name: "Ada", age: 36, traceId: "abc" }),
    suite: "validation-kern",
    verify: (result) => {
      verifySuccess(result)
      if (!(typeof result === "object" && result !== null && "data" in result)) return
      invariant(
        typeof result.data === "object" &&
          result.data !== null &&
          "traceId" in result.data &&
          result.data.traceId === "abc",
        "passthrough must retain unknown keys",
      )
    },
  },
  {
    name: "bounded aggregate failure",
    run: () => integerArraySchema.safeParse(boundedFailureInput, { maxIssues: 10 }),
    size: 1_000,
    suite: "validation-kern",
    unit: "items",
    verify: (result) => verifyFailureCount(result, 10),
  },
  {
    name: "Standard Schema validation",
    run: () => simpleSchema["~standard"].validate({ name: "Ada", age: 36 }),
    suite: "validation-kern",
    verify: (result) => {
      invariant(
        typeof result === "object" && result !== null && "value" in result,
        "standard output",
      )
    },
  },
  ...largeArrayBenchmarks,
  ...wideInputBenchmarks,
  ...wideSchemaBenchmarks,
  ...recordBenchmarks,
  ...allFailureBenchmarks,
]
