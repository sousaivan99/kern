import { describe, expect, test } from "bun:test"
import type { BenchmarkCase, BenchmarkDefinition } from "../benchmarks/harness.js"
import { validationComparisonBenchmarks } from "../benchmarks/validation-compare.bench.js"

const isSupported = (benchmark: BenchmarkDefinition): benchmark is BenchmarkCase =>
  !("unsupported" in benchmark)

const supportedBenchmarks = validationComparisonBenchmarks.filter(isSupported)

describe("validation comparison benchmark", () => {
  test("keeps deterministic library coverage for every scenario", () => {
    const scenarios = new Map<string, string[]>()

    for (const benchmark of validationComparisonBenchmarks) {
      const libraries = scenarios.get(benchmark.name) ?? []
      libraries.push(benchmark.library ?? "Kern")
      scenarios.set(benchmark.name, libraries)
    }

    expect(validationComparisonBenchmarks).toHaveLength(87)
    expect(scenarios.size).toBe(29)
    for (const libraries of scenarios.values()) {
      expect(libraries).toEqual(["Kern", "Zod", "Valibot"])
    }
  })

  test("verifies every supported adapter result outside the timed path", () => {
    expect(supportedBenchmarks).toHaveLength(86)
    for (const benchmark of supportedBenchmarks) {
      expect(benchmark.verify).toBeFunction()
      benchmark.verify?.(benchmark.run())
    }
  })

  test("records scaling dimensions without normalizing early abort", () => {
    const validArrays = supportedBenchmarks.filter((benchmark) =>
      benchmark.name.includes("item valid array"),
    )
    expect(validArrays.map((benchmark) => benchmark.size)).toEqual([
      1, 1, 1, 10, 10, 10, 100, 100, 100, 1_000, 1_000, 1_000,
    ])
    expect(validArrays.every((benchmark) => benchmark.itemsPerOperation === benchmark.size)).toBe(
      true,
    )

    const earlyAbort = validationComparisonBenchmarks.filter((benchmark) =>
      benchmark.name.startsWith("abort on first issue"),
    )
    expect(earlyAbort).toHaveLength(3)
    for (const benchmark of earlyAbort) {
      if ("unsupported" in benchmark) continue
      expect(benchmark.itemsPerOperation).toBeUndefined()
    }
    expect(earlyAbort.find((benchmark) => benchmark.library === "Zod")).toMatchObject({
      unsupported: "no parse-level abortEarly option",
    })
  })
})
