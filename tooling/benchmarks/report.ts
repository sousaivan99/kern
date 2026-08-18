import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { basename, resolve } from "node:path"

interface ArtifactMetadata {
  readonly architecture: string
  readonly benchmarkSourceHash: string
  readonly bunLockHash: string
  readonly cpu: string
  readonly cpuGovernor?: string
  readonly gitHead: string
  readonly libraryOrder?: readonly string[]
  readonly mode: string
  readonly platform: string
  readonly runtime: string
  readonly sampleCount: number
  readonly sampleDurationMilliseconds: number
  readonly trackedDiffHash: string
  readonly untrackedManifestHash: string
  readonly warmupDurationMilliseconds: number
}

interface TimedResult {
  readonly id: string
  readonly library: string
  readonly libraryVersion: string
  readonly name: string
  readonly scenarioId: string
  readonly statistics: { readonly nanosecondsPerOperation: number }
  readonly suite: string
}

interface UnsupportedResult {
  readonly id: string
  readonly library: string
  readonly libraryVersion: string
  readonly name: string
  readonly scenarioId: string
  readonly suite: string
  readonly unsupported: string
}

interface BenchmarkArtifact {
  readonly metadata: ArtifactMetadata
  readonly results: readonly (TimedResult | UnsupportedResult)[]
}

export interface SummarizedResult {
  readonly id: string
  readonly library: string
  readonly libraryVersion: string
  readonly medianOfRunMediansNanoseconds?: number
  readonly name: string
  readonly runMediansNanoseconds?: readonly number[]
  readonly scenarioId: string
  readonly suite: string
  readonly unsupported?: string
}

export interface BenchmarkSummary {
  readonly artifactHashes: readonly string[]
  readonly libraryOrders: readonly (readonly string[])[]
  readonly metadata: Omit<ArtifactMetadata, "libraryOrder">
  readonly results: readonly SummarizedResult[]
}

const stableMetadataKeys = [
  "architecture",
  "benchmarkSourceHash",
  "bunLockHash",
  "cpu",
  "cpuGovernor",
  "gitHead",
  "mode",
  "platform",
  "runtime",
  "sampleCount",
  "sampleDurationMilliseconds",
  "trackedDiffHash",
  "untrackedManifestHash",
  "warmupDurationMilliseconds",
] as const

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex")

const median = (values: readonly number[]): number => {
  if (values.length === 0) throw new Error("Cannot calculate a median without values")
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle]
  if (upper === undefined) throw new Error("Cannot calculate a median without values")
  if (sorted.length % 2 === 1) return upper
  return ((sorted[middle - 1] ?? upper) + upper) / 2
}

const isTimed = (result: TimedResult | UnsupportedResult): result is TimedResult =>
  "statistics" in result

const assertCompatibleMetadata = (artifacts: readonly BenchmarkArtifact[]): void => {
  const first = artifacts[0]
  if (!first) throw new Error("At least one artifact is required")
  if (first.metadata.mode !== "full") throw new Error("Performance reports require full-mode runs")

  for (const artifact of artifacts.slice(1)) {
    for (const key of stableMetadataKeys) {
      if (artifact.metadata[key] !== first.metadata[key]) {
        throw new Error(`Artifact metadata mismatch for ${key}`)
      }
    }
  }

  const orders = artifacts.map((artifact) => artifact.metadata.libraryOrder ?? [])
  const populatedOrders = orders.filter((order) => order.length > 0)
  if (populatedOrders.length !== 0 && populatedOrders.length !== artifacts.length) {
    throw new Error("Artifacts must either all record a library order or all omit it")
  }
  if (populatedOrders.length > 0) {
    const libraries = new Set(populatedOrders[0])
    if (
      populatedOrders.some(
        (order) =>
          order.length !== libraries.size || order.some((library) => !libraries.has(library)),
      )
    ) {
      throw new Error("Artifacts do not contain compatible library orders")
    }
    if (libraries.size === artifacts.length) {
      for (let position = 0; position < libraries.size; position += 1) {
        if (new Set(populatedOrders.map((order) => order[position])).size !== libraries.size) {
          throw new Error("Artifacts do not contain a Latin-square library rotation")
        }
      }
    }
  }
}

const assertScenarioRotations = (artifacts: readonly BenchmarkArtifact[]): void => {
  const orders = artifacts.map((artifact) => artifact.metadata.libraryOrder ?? [])
  if (orders.every((order) => order.length === 0)) return
  const first = artifacts[0]
  if (!first) return
  const scenarios = new Map<string, Set<string>>()
  for (const result of first.results) {
    const libraries = scenarios.get(result.scenarioId) ?? new Set<string>()
    libraries.add(result.library)
    scenarios.set(result.scenarioId, libraries)
  }

  for (const [scenario, librarySet] of scenarios) {
    const libraries = [...librarySet]
    if (libraries.length < 2) continue
    if (libraries.length !== artifacts.length) {
      throw new Error(
        `Scenario ${scenario} must have ${artifacts.length} libraries for a three-run rotation`,
      )
    }
    const relativeOrders = orders.map((order) => order.filter((library) => librarySet.has(library)))
    if (relativeOrders.some((order) => order.length !== libraries.length)) {
      throw new Error(`Library order is missing a competitor for scenario ${scenario}`)
    }
    for (let position = 0; position < libraries.length; position += 1) {
      if (new Set(relativeOrders.map((order) => order[position])).size !== libraries.length) {
        throw new Error(`Scenario ${scenario} does not contain a Latin-square library rotation`)
      }
    }
  }
}

export const summarizeBenchmarkRuns = (
  artifacts: readonly BenchmarkArtifact[],
  artifactHashes: readonly string[] = [],
): BenchmarkSummary => {
  if (artifacts.length !== 3) throw new Error("Exactly three benchmark artifacts are required")
  assertCompatibleMetadata(artifacts)

  const first = artifacts[0]
  if (!first) throw new Error("Exactly three benchmark artifacts are required")
  const expectedIds = new Set(first.results.map((result) => result.id))
  for (const artifact of artifacts.slice(1)) {
    const ids = new Set(artifact.results.map((result) => result.id))
    if (ids.size !== expectedIds.size || [...expectedIds].some((id) => !ids.has(id))) {
      throw new Error("Artifacts do not contain the same benchmark result IDs")
    }
  }
  assertScenarioRotations(artifacts)

  const results = first.results.map<SummarizedResult>((firstResult) => {
    const matching = artifacts.map((artifact) => {
      const result = artifact.results.find((candidate) => candidate.id === firstResult.id)
      if (!result) throw new Error(`Missing benchmark result ${firstResult.id}`)
      return result
    })

    if (!isTimed(firstResult)) {
      const reasons = matching.map((result) =>
        "unsupported" in result ? result.unsupported : "timed in another artifact",
      )
      if (new Set(reasons).size !== 1) {
        throw new Error(`Unsupported status changed for ${firstResult.id}`)
      }
      return {
        id: firstResult.id,
        library: firstResult.library,
        libraryVersion: firstResult.libraryVersion,
        name: firstResult.name,
        scenarioId: firstResult.scenarioId,
        suite: firstResult.suite,
        unsupported: firstResult.unsupported,
      }
    }

    if (matching.some((result) => !isTimed(result))) {
      throw new Error(`Timed status changed for ${firstResult.id}`)
    }
    const runMedians = matching.map(
      (result) => (result as TimedResult).statistics.nanosecondsPerOperation,
    )
    return {
      id: firstResult.id,
      library: firstResult.library,
      libraryVersion: firstResult.libraryVersion,
      medianOfRunMediansNanoseconds: median(runMedians),
      name: firstResult.name,
      runMediansNanoseconds: runMedians,
      scenarioId: firstResult.scenarioId,
      suite: firstResult.suite,
    }
  })

  const { libraryOrder: _libraryOrder, ...metadata } = first.metadata
  return {
    artifactHashes,
    libraryOrders: artifacts.map((artifact) => artifact.metadata.libraryOrder ?? []),
    metadata,
    results,
  }
}

const escapeCell = (value: string): string => value.replaceAll("|", "\\|")

const formatDuration = (nanoseconds: number): string => {
  if (nanoseconds >= 1_000_000) return `${(nanoseconds / 1_000_000).toFixed(2)} ms`
  if (nanoseconds >= 1_000) return `${(nanoseconds / 1_000).toFixed(2)} µs`
  return `${nanoseconds.toFixed(1)} ns`
}

const markdown = (summary: BenchmarkSummary): string => {
  const rows = summary.results.map((result) => [
    escapeCell(result.scenarioId),
    escapeCell(`${result.library} ${result.libraryVersion}`),
    result.medianOfRunMediansNanoseconds === undefined
      ? escapeCell(`Unsupported: ${result.unsupported ?? "unknown reason"}`)
      : formatDuration(result.medianOfRunMediansNanoseconds),
  ])
  return [
    "| Scenario ID | Library | Median of run medians |",
    "| --- | --- | ---: |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n")
}

const parseCli = (
  arguments_: readonly string[],
): {
  readonly files: readonly string[]
  readonly json: boolean
  readonly scenarios: Set<string>
} => {
  const files: string[] = []
  const scenarios = new Set<string>()
  let json = false
  for (const argument of arguments_) {
    if (argument === "--json") json = true
    else if (argument.startsWith("--scenario=")) {
      const scenario = argument.slice("--scenario=".length)
      if (scenario === "") throw new Error("--scenario requires a stable scenario ID")
      scenarios.add(scenario)
    } else if (argument.startsWith("--")) throw new Error(`Unknown report option: ${argument}`)
    else files.push(resolve(argument))
  }
  return { files, json, scenarios }
}

const runCli = (): void => {
  const configuration = parseCli(process.argv.slice(2))
  if (configuration.files.length !== 3) {
    throw new Error(
      "Usage: bun run benchmark:report -- <run-1.json> <run-2.json> <run-3.json> [--json] [--scenario=<id>]",
    )
  }

  const sources = configuration.files.map((file) => readFileSync(file, "utf8"))
  const artifacts = sources.map((source, index) => {
    try {
      return JSON.parse(source) as BenchmarkArtifact
    } catch {
      throw new Error(
        `Invalid benchmark JSON: ${basename(configuration.files[index] ?? "unknown")}`,
      )
    }
  })
  const summary = summarizeBenchmarkRuns(artifacts, sources.map(sha256))
  const filtered =
    configuration.scenarios.size === 0
      ? summary
      : {
          ...summary,
          results: summary.results.filter((result) =>
            configuration.scenarios.has(result.scenarioId),
          ),
        }

  console.log(configuration.json ? JSON.stringify(filtered, null, 2) : markdown(filtered))
}

if (import.meta.main) runCli()
