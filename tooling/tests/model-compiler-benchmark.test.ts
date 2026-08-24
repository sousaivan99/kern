import { describe, expect, test } from "bun:test"
import type { BenchmarkCase } from "../benchmarks/harness.js"
import {
  modelCompilerBenchmarks,
  modelCompilerGenerationBenchmarks,
} from "../benchmarks/model-compiler.bench.js"

describe("model compiler benchmarks", () => {
  test("compares runtime and compiled validation for every scenario", () => {
    const scenarios = new Map<string, string[]>()
    for (const benchmark of modelCompilerBenchmarks) {
      const key = `${benchmark.name}:${benchmark.size ?? "default"}`
      const libraries = scenarios.get(key) ?? []
      libraries.push(benchmark.library ?? "Kern")
      scenarios.set(key, libraries)
    }

    expect(scenarios.size).toBe(22)
    expect(modelCompilerBenchmarks).toHaveLength(44)
    for (const libraries of scenarios.values()) {
      expect(libraries).toEqual(["Kern runtime", "Kern compiled"])
    }
  })

  test("verifies correctness outside every timed validation path", () => {
    for (const benchmark of modelCompilerBenchmarks) {
      expect(benchmark.verify).toBeFunction()
      benchmark.verify?.(benchmark.run())
    }
  })

  test("covers compiler generation from 3 through 1,000 fields", () => {
    expect(modelCompilerGenerationBenchmarks.map((benchmark) => benchmark.size)).toEqual([
      3, 10, 100, 1_000,
    ])
    for (const benchmark of modelCompilerGenerationBenchmarks as readonly BenchmarkCase[]) {
      expect(benchmark.verify).toBeFunction()
      benchmark.verify?.(benchmark.run())
    }
  })
})
