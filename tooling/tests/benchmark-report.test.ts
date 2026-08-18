import { describe, expect, test } from "bun:test"
import { summarizeBenchmarkRuns } from "../benchmarks/report.js"

const artifact = (value: number, order: readonly string[]) => ({
  metadata: {
    architecture: "x64",
    benchmarkSourceHash: "benchmark-hash",
    bunLockHash: "lock-hash",
    cpu: "test CPU",
    cpuGovernor: "performance",
    gitHead: "git-head",
    libraryOrder: order,
    mode: "full",
    platform: "linux",
    runtime: "Bun 1.3.14",
    sampleCount: 21,
    sampleDurationMilliseconds: 20,
    trackedDiffHash: "diff-hash",
    untrackedManifestHash: "untracked-hash",
    warmupDurationMilliseconds: 20,
  },
  results: [
    {
      id: "suite:scenario:kern",
      library: "Kern",
      libraryVersion: "1.0.0",
      name: "scenario",
      scenarioId: "suite:scenario",
      statistics: { nanosecondsPerOperation: value },
      suite: "suite",
    },
  ],
})

const heterogeneousArtifact = (order: readonly string[]) => ({
  ...artifact(10, order),
  results: ["Kern", "es-toolkit", "Lodash"].map((library, index) => ({
    id: `array:scenario:${library}`,
    library,
    libraryVersion: "1.0.0",
    name: "array scenario",
    scenarioId: "array:scenario",
    statistics: { nanosecondsPerOperation: 10 + index },
    suite: "array",
  })),
})

describe("benchmark report", () => {
  test("calculates the median of three run medians", () => {
    const summary = summarizeBenchmarkRuns([
      artifact(30, ["Kern", "Zod", "Valibot"]),
      artifact(10, ["Zod", "Valibot", "Kern"]),
      artifact(20, ["Valibot", "Kern", "Zod"]),
    ])

    expect(summary.results[0]).toMatchObject({
      medianOfRunMediansNanoseconds: 20,
      runMediansNanoseconds: [30, 10, 20],
    })
    expect(summary.libraryOrders).toEqual([
      ["Kern", "Zod", "Valibot"],
      ["Zod", "Valibot", "Kern"],
      ["Valibot", "Kern", "Zod"],
    ])
  })

  test("rejects artifacts from different source states", () => {
    const changed = artifact(20, ["Zod", "Valibot", "Kern"])
    changed.metadata.trackedDiffHash = "different-diff"

    expect(() =>
      summarizeBenchmarkRuns([
        artifact(10, ["Kern", "Zod", "Valibot"]),
        changed,
        artifact(30, ["Valibot", "Kern", "Zod"]),
      ]),
    ).toThrow("Artifact metadata mismatch for trackedDiffHash")
  })

  test("rejects a fixed competitor order", () => {
    expect(() =>
      summarizeBenchmarkRuns([
        artifact(10, ["Kern", "Zod", "Valibot"]),
        artifact(20, ["Kern", "Zod", "Valibot"]),
        artifact(30, ["Kern", "Zod", "Valibot"]),
      ]),
    ).toThrow("Artifacts do not contain a Latin-square library rotation")
  })

  test("accepts scenario-relative rotations in a larger library order", () => {
    expect(() =>
      summarizeBenchmarkRuns([
        heterogeneousArtifact(["Kern", "es-toolkit", "Lodash", "date-fns"]),
        heterogeneousArtifact(["es-toolkit", "Lodash", "date-fns", "Kern"]),
        heterogeneousArtifact(["Lodash", "date-fns", "Kern", "es-toolkit"]),
      ]),
    ).not.toThrow()
  })
})
