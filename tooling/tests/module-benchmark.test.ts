import { describe, expect, test } from "bun:test"
import { moduleComparisonBenchmarks } from "../benchmarks/module-compare.bench.js"

describe("module comparison benchmarks", () => {
  test("keeps three deterministic adapters for every scenario", () => {
    const scenarios = new Map<string, string[]>()
    for (const benchmark of moduleComparisonBenchmarks) {
      const id = benchmark.id ?? ""
      const libraries = scenarios.get(id) ?? []
      libraries.push(benchmark.library ?? "Kern")
      scenarios.set(id, libraries)
    }
    expect(moduleComparisonBenchmarks).toHaveLength(69)
    expect(scenarios.size).toBe(23)
    for (const libraries of scenarios.values()) expect(libraries).toHaveLength(3)
  })

  test("verifies every competitor adapter outside the timed path", async () => {
    for (const benchmark of moduleComparisonBenchmarks) {
      expect(benchmark.verify).toBeFunction()
      await benchmark.verify?.(await benchmark.run())
    }
  })

  test("covers every non-validation Kern module", () => {
    expect(new Set(moduleComparisonBenchmarks.map((benchmark) => benchmark.suite))).toEqual(
      new Set([
        "array-compare",
        "object-compare",
        "string-compare",
        "number-compare",
        "date-compare",
        "money-compare",
        "async-control-compare",
        "async-retry-compare",
      ]),
    )
  })
})
