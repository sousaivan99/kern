import { array, number, object, string } from "../src/validation/index.js"

interface Benchmark {
  readonly name: string
  readonly iterations: number
  readonly run: () => unknown
}

const simpleSchema = object({ name: string().min(2), age: number().integer().min(18) })
const nestedSchema = object({
  user: object({
    name: string(),
    contacts: array(object({ email: string().email() })),
  }),
})
const arraySchema = array(number().integer())

const benchmarks: readonly Benchmark[] = [
  {
    name: "simple object parse",
    iterations: 200_000,
    run: () => simpleSchema.parse({ name: "Ada", age: 36 }),
  },
  {
    name: "nested object validation",
    iterations: 100_000,
    run: () =>
      nestedSchema.safeParse({
        user: { name: "Ada", contacts: [{ email: "ada@example.com" }] },
      }),
  },
  {
    name: "array validation (10)",
    iterations: 100_000,
    run: () => arraySchema.safeParse([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  },
  {
    name: "safeParse success",
    iterations: 250_000,
    run: () => simpleSchema.safeParse({ name: "Ada", age: 36 }),
  },
  {
    name: "safeParse failure",
    iterations: 150_000,
    run: () => simpleSchema.safeParse({ name: "A", age: 12 }),
  },
]

let sink: unknown
for (const benchmark of benchmarks) {
  for (let index = 0; index < 5_000; index += 1) sink = benchmark.run()
  const start = performance.now()
  for (let index = 0; index < benchmark.iterations; index += 1) sink = benchmark.run()
  const elapsed = performance.now() - start
  const operationsPerSecond = Math.round(benchmark.iterations / (elapsed / 1_000))
  console.log(
    `${benchmark.name.padEnd(27)} ${operationsPerSecond.toLocaleString("en-US").padStart(12)} ops/s  (${elapsed.toFixed(1)} ms)`,
  )
}

void sink
