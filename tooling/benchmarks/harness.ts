import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { cpus } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import packageMetadata from "../../packages/kern/package.json"
import { type TableColumn, terminal } from "../scripts/shared/console.js"
import { type ComparisonScore, scoreComparison } from "./score.js"

export interface BenchmarkCase {
  readonly async?: boolean
  readonly category?: string
  readonly id?: string
  readonly itemsPerOperation?: number
  readonly iterationCap?: number
  readonly library?: string
  readonly libraryVersion?: string
  readonly name: string
  readonly prepareBatch?: (iterations: number) => () => unknown | Promise<unknown>
  readonly run: () => unknown | Promise<unknown>
  readonly size?: number
  readonly suite: string
  readonly unit?: string
  readonly verify?: (result: unknown) => void | Promise<void>
}

export interface UnsupportedBenchmarkCase {
  readonly category?: string
  readonly id?: string
  readonly library: string
  readonly libraryVersion: string
  readonly name: string
  readonly size?: number
  readonly suite: string
  readonly unit?: string
  readonly unsupported: string
}

export type BenchmarkDefinition = BenchmarkCase | UnsupportedBenchmarkCase

interface BenchmarkConfiguration {
  readonly json: boolean
  readonly libraryOrder?: readonly string[]
  readonly quick: boolean
  readonly sampleCount: number
  readonly sampleDurationMilliseconds: number
  readonly suite?: string
  readonly warmupDurationMilliseconds: number
}

interface BenchmarkStatistics {
  readonly iterations: number
  readonly maximumMilliseconds: number
  readonly meanMilliseconds: number
  readonly medianMilliseconds: number
  readonly minimumMilliseconds: number
  readonly nanosecondsPerItem?: number
  readonly nanosecondsPerOperation: number
  readonly operationsPerSecond: number
  readonly p95Milliseconds: number
  readonly samplesMilliseconds: readonly number[]
}

interface BenchmarkResult {
  readonly category?: string
  readonly id: string
  readonly itemsPerOperation?: number
  readonly library: string
  readonly libraryVersion: string
  readonly name: string
  readonly scenarioId: string
  readonly size?: number
  readonly statistics: BenchmarkStatistics
  readonly suite: string
  readonly unit?: string
}

interface UnsupportedBenchmarkResult extends UnsupportedBenchmarkCase {
  readonly id: string
  readonly scenarioId: string
}

type ReportedBenchmarkResult = BenchmarkResult | UnsupportedBenchmarkResult

const fullConfiguration = {
  sampleCount: 21,
  sampleDurationMilliseconds: 20,
  warmupDurationMilliseconds: 20,
} as const

const quickConfiguration = {
  sampleCount: 5,
  sampleDurationMilliseconds: 5,
  warmupDurationMilliseconds: 5,
} as const

let sink: unknown

const repositoryRoot = process.env.KERN_BENCHMARK_ROOT
  ? resolve(process.env.KERN_BENCHMARK_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex")

const git = (arguments_: readonly string[]): string => {
  const result = spawnSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
  if (result.status !== 0) throw new Error(result.stderr || `git ${arguments_.join(" ")} failed`)
  return result.stdout
}

const filesUnder = (directory: string): string[] => {
  const output: string[] = []
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) visit(path)
      else output.push(path)
    }
  }
  visit(directory)
  return output.sort()
}

const hashFiles = (files: readonly string[]): string => {
  const digest = createHash("sha256")
  for (const file of files) {
    digest.update(relative(repositoryRoot, file))
    digest.update("\0")
    digest.update(readFileSync(file))
    digest.update("\0")
  }
  return digest.digest("hex")
}

const untrackedManifest = (): { readonly files: readonly string[]; readonly hash: string } => {
  const files = git(["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .filter(Boolean)
    .sort()
  const digest = createHash("sha256")
  for (const file of files) {
    digest.update(file)
    digest.update("\0")
    digest.update(readFileSync(join(repositoryRoot, file)))
    digest.update("\0")
  }
  return { files, hash: digest.digest("hex") }
}

const readSystemValue = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf8").trim()
  } catch {
    return undefined
  }
}

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")

const scenarioId = (benchmark: BenchmarkDefinition): string =>
  benchmark.id ??
  [benchmark.suite, benchmark.category, benchmark.name, benchmark.size]
    .filter((value) => value !== undefined)
    .map(String)
    .map(slug)
    .join(":")

const resultId = (benchmark: BenchmarkDefinition): string =>
  `${scenarioId(benchmark)}:${slug(benchmark.library ?? "Kern")}`

const percentile = (sortedValues: readonly number[], percentage: number): number => {
  const index = Math.max(0, Math.ceil(sortedValues.length * percentage) - 1)
  return sortedValues[index] ?? 0
}

const parseArguments = (): BenchmarkConfiguration => {
  const arguments_ = process.argv.slice(2)
  let json = false
  let libraryOrder: readonly string[] | undefined
  let quick = false
  let suite: string | undefined

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument === "--json") json = true
    else if (argument === "--quick") quick = true
    else if (argument === "--library-order") {
      libraryOrder = arguments_[index + 1]?.split(",")
      index += 1
    } else if (argument?.startsWith("--library-order=")) {
      libraryOrder = argument.slice("--library-order=".length).split(",")
    } else if (argument === "--suite") {
      suite = arguments_[index + 1]
      index += 1
    } else if (argument?.startsWith("--suite=")) suite = argument.slice("--suite=".length)
    else throw new Error(`Unknown benchmark option: ${argument}`)
  }

  if (suite === "") throw new Error("--suite requires a non-empty suite name")
  if (
    libraryOrder &&
    (libraryOrder.some((library) => library === "") ||
      new Set(libraryOrder).size !== libraryOrder.length)
  ) {
    throw new Error("--library-order requires a comma-separated list of unique library names")
  }
  const timing = quick ? quickConfiguration : fullConfiguration
  return {
    json,
    ...(libraryOrder === undefined ? {} : { libraryOrder }),
    quick,
    ...timing,
    ...(suite === undefined ? {} : { suite }),
  }
}

const measureBatch = (benchmark: BenchmarkCase, iterations: number): number => {
  const run = benchmark.prepareBatch?.(iterations) ?? benchmark.run
  const start = performance.now()
  for (let index = 0; index < iterations; index += 1) sink = run()
  return performance.now() - start
}

const calibrateIterations = (benchmark: BenchmarkCase, targetMilliseconds: number): number => {
  const iterationCap = benchmark.iterationCap ?? 10_000_000
  let iterations = 1
  while (iterations < iterationCap) {
    const elapsed = measureBatch(benchmark, iterations)
    if (elapsed >= targetMilliseconds * 0.75) return iterations
    const multiplier = Math.min(
      10,
      Math.max(2, Math.floor(targetMilliseconds / Math.max(elapsed, 0.001))),
    )
    iterations = Math.min(iterationCap, iterations * multiplier)
  }
  return iterations
}

const warmUp = (benchmark: BenchmarkCase, durationMilliseconds: number): void => {
  let elapsed = 0
  let iterations = 1
  while (elapsed < durationMilliseconds) {
    elapsed += measureBatch(benchmark, iterations)
    iterations = Math.min(iterations * 2, 1_024)
  }
}

const measureBatchAsync = async (benchmark: BenchmarkCase, iterations: number): Promise<number> => {
  const run = benchmark.prepareBatch?.(iterations) ?? benchmark.run
  const start = performance.now()
  for (let index = 0; index < iterations; index += 1) sink = await run()
  return performance.now() - start
}

const calibrateIterationsAsync = async (
  benchmark: BenchmarkCase,
  targetMilliseconds: number,
): Promise<number> => {
  const iterationCap = benchmark.iterationCap ?? 10_000_000
  let iterations = 1
  while (iterations < iterationCap) {
    const elapsed = await measureBatchAsync(benchmark, iterations)
    if (elapsed >= targetMilliseconds * 0.75) return iterations
    const multiplier = Math.min(
      10,
      Math.max(2, Math.floor(targetMilliseconds / Math.max(elapsed, 0.001))),
    )
    iterations = Math.min(iterationCap, iterations * multiplier)
  }
  return iterations
}

const warmUpAsync = async (
  benchmark: BenchmarkCase,
  durationMilliseconds: number,
): Promise<void> => {
  let elapsed = 0
  let iterations = 1
  while (elapsed < durationMilliseconds) {
    elapsed += await measureBatchAsync(benchmark, iterations)
    iterations = Math.min(iterations * 2, 1_024)
  }
}

const benchmarkResult = (
  benchmark: BenchmarkCase,
  iterations: number,
  samples: readonly number[],
): BenchmarkResult => {
  const medianMilliseconds = percentile(samples, 0.5)
  const nanosecondsPerOperation = (medianMilliseconds * 1_000_000) / iterations
  const itemsPerOperation = benchmark.itemsPerOperation
  const library = benchmark.library ?? "Kern"
  const libraryVersion = benchmark.libraryVersion ?? packageMetadata.version
  const statistics: BenchmarkStatistics = {
    iterations,
    maximumMilliseconds: samples.at(-1) ?? 0,
    meanMilliseconds: samples.reduce((total, sample) => total + sample, 0) / samples.length,
    medianMilliseconds,
    minimumMilliseconds: samples[0] ?? 0,
    nanosecondsPerOperation,
    operationsPerSecond: 1_000_000_000 / nanosecondsPerOperation,
    p95Milliseconds: percentile(samples, 0.95),
    samplesMilliseconds: samples,
  }
  return {
    ...(benchmark.itemsPerOperation === undefined
      ? {}
      : { itemsPerOperation: benchmark.itemsPerOperation }),
    library,
    libraryVersion,
    id: resultId(benchmark),
    name: benchmark.name,
    ...(benchmark.category === undefined ? {} : { category: benchmark.category }),
    ...(benchmark.size === undefined ? {} : { size: benchmark.size }),
    statistics:
      itemsPerOperation === undefined
        ? statistics
        : { ...statistics, nanosecondsPerItem: nanosecondsPerOperation / itemsPerOperation },
    suite: benchmark.suite,
    scenarioId: scenarioId(benchmark),
    ...(benchmark.unit === undefined ? {} : { unit: benchmark.unit }),
  }
}

const measure = (
  benchmark: BenchmarkCase,
  configuration: BenchmarkConfiguration,
): BenchmarkResult => {
  const verificationResult = benchmark.run()
  benchmark.verify?.(verificationResult)
  sink = verificationResult

  warmUp(benchmark, configuration.warmupDurationMilliseconds)
  const iterations = calibrateIterations(benchmark, configuration.sampleDurationMilliseconds)
  const samples = Array.from({ length: configuration.sampleCount }, () =>
    measureBatch(benchmark, iterations),
  ).sort((left, right) => left - right)
  return benchmarkResult(benchmark, iterations, samples)
}

const measureAsync = async (
  benchmark: BenchmarkCase,
  configuration: BenchmarkConfiguration,
): Promise<BenchmarkResult> => {
  const verificationResult = await benchmark.run()
  await benchmark.verify?.(verificationResult)
  sink = verificationResult

  await warmUpAsync(benchmark, configuration.warmupDurationMilliseconds)
  const iterations = await calibrateIterationsAsync(
    benchmark,
    configuration.sampleDurationMilliseconds,
  )
  const samples: number[] = []
  for (let index = 0; index < configuration.sampleCount; index += 1) {
    samples.push(await measureBatchAsync(benchmark, iterations))
  }
  samples.sort((left, right) => left - right)
  return benchmarkResult(benchmark, iterations, samples)
}

const formatCount = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)

const formatDuration = (nanoseconds: number): string => {
  if (nanoseconds < 1_000) return `${nanoseconds.toFixed(1)} ns`
  if (nanoseconds < 1_000_000) return `${(nanoseconds / 1_000).toFixed(2)} us`
  return `${(nanoseconds / 1_000_000).toFixed(2)} ms`
}

const printTable = (results: readonly ReportedBenchmarkResult[]): void => {
  const includesCategories = results.some((result) => result.category !== undefined)
  const columns: readonly TableColumn<ReportedBenchmarkResult>[] = [
    {
      header: "suite",
      style: (result) => (result.suite === "validation" ? "magenta" : "cyan"),
      value: (result) => result.suite,
    },
    { header: "library", style: "cyan", value: (result) => result.library },
    { header: "version", style: "dim", value: (result) => result.libraryVersion },
    ...(includesCategories
      ? [
          {
            header: "category",
            style: "dim" as const,
            value: (result: ReportedBenchmarkResult) => result.category ?? "—",
          },
        ]
      : []),
    { header: "benchmark", value: (result) => result.name },
    {
      align: "right",
      header: "workload",
      style: "dim",
      value: (result) =>
        result.size === undefined
          ? "—"
          : `${formatCount(result.size)}${result.unit ? ` ${result.unit}` : ""}`,
    },
    {
      align: "right",
      header: "median/op",
      style: "yellow",
      value: (result) =>
        "unsupported" in result
          ? `unsupported: ${result.unsupported}`
          : formatDuration(result.statistics.nanosecondsPerOperation),
    },
    {
      align: "right",
      header: "p95/op",
      style: "magenta",
      value: (result) =>
        "unsupported" in result
          ? "—"
          : formatDuration(
              (result.statistics.p95Milliseconds * 1_000_000) / result.statistics.iterations,
            ),
    },
    {
      align: "right",
      header: "ops/s",
      style: "green",
      value: (result) =>
        "unsupported" in result ? "—" : formatCount(result.statistics.operationsPerSecond),
    },
    {
      align: "right",
      header: "time/unit",
      style: "cyan",
      value: (result) =>
        "unsupported" in result || result.statistics.nanosecondsPerItem === undefined
          ? "—"
          : formatDuration(result.statistics.nanosecondsPerItem),
    },
  ]
  terminal.table(results, columns)
}

const comparisonScores = (
  results: readonly ReportedBenchmarkResult[],
): readonly (ComparisonScore & { readonly suite: string })[] => {
  const suites = [...new Set(results.map((result) => result.suite))]
  return suites.flatMap((suite) => {
    const suiteResults = results.filter((result) => result.suite === suite)
    const libraries = new Set(suiteResults.map((result) => result.library))
    if (libraries.size < 2) return []
    const score = scoreComparison(
      suiteResults.map((result) =>
        "unsupported" in result
          ? {
              library: result.library,
              scenario: result.scenarioId,
              unsupported: result.unsupported,
            }
          : {
              library: result.library,
              medianNanoseconds: result.statistics.nanosecondsPerOperation,
              scenario: result.scenarioId,
            },
      ),
    )
    return [{ ...score, suite }]
  })
}

const printComparisonScore = (
  score: ComparisonScore & { readonly suite: string },
  quick: boolean,
): void => {
  terminal.heading(
    `${score.suite} diagnostic score${quick ? " (quick mode; smoke only)" : " (non-gating)"}`,
  )
  terminal.table(score.rows, [
    { header: "library", style: "cyan", value: (row) => row.library },
    {
      align: "right",
      header: "score",
      style: "green",
      value: (row) => `${row.score.toFixed(2)} / ${score.scoredScenarios}`,
    },
    {
      align: "right",
      header: "clear wins",
      style: "yellow",
      value: (row) => row.clearWins,
    },
    {
      align: "right",
      header: "near-ties",
      style: "magenta",
      value: (row) => row.tiedFastest,
    },
    { align: "right", header: "slower", style: "dim", value: (row) => row.slower },
    {
      align: "right",
      header: "coverage",
      value: (row) => `${row.coverage} / ${score.totalScenarios}`,
    },
  ])
  terminal.detail(
    "policy",
    `1 point per shared scenario; split among medians within ${score.tieBandPercent}% of fastest`,
  )
  terminal.detail(
    "scored",
    `${score.scoredScenarios}/${score.totalScenarios} scenarios with complete library coverage`,
  )
  if (score.excludedScenarios.length > 0) {
    terminal.detail("excluded", score.excludedScenarios.join(", "))
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Benchmark verification failed: ${message}`)
}

export const runBenchmarks = async (benchmarks: readonly BenchmarkDefinition[]): Promise<void> => {
  const configuration = parseArguments()
  let selected = configuration.suite
    ? benchmarks.filter((benchmark) => benchmark.suite === configuration.suite)
    : benchmarks
  if (selected.length === 0) {
    const suites = [...new Set(benchmarks.map((benchmark) => benchmark.suite))].join(", ")
    throw new Error(`No benchmarks found for suite ${configuration.suite}. Available: ${suites}`)
  }

  if (configuration.libraryOrder) {
    const rank = new Map(configuration.libraryOrder.map((library, index) => [library, index]))
    const scenarioRank = new Map<string, number>()
    for (const [index, benchmark] of selected.entries()) {
      const id = scenarioId(benchmark)
      if (!scenarioRank.has(id)) scenarioRank.set(id, index)
    }
    selected = [...selected].sort((left, right) => {
      const scenarioDifference =
        (scenarioRank.get(scenarioId(left)) ?? 0) - (scenarioRank.get(scenarioId(right)) ?? 0)
      if (scenarioDifference !== 0) return scenarioDifference
      return (
        (rank.get(left.library ?? "Kern") ?? rank.size) -
        (rank.get(right.library ?? "Kern") ?? rank.size)
      )
    })
  }

  const results: ReportedBenchmarkResult[] = []
  for (const benchmark of selected) {
    if ("unsupported" in benchmark) {
      results.push({ ...benchmark, id: resultId(benchmark), scenarioId: scenarioId(benchmark) })
    } else {
      results.push(
        benchmark.async
          ? await measureAsync(benchmark, configuration)
          : measure(benchmark, configuration),
      )
    }
  }
  const untracked = untrackedManifest()
  const benchmarkSourceFiles = filesUnder(join(repositoryRoot, "tooling/benchmarks"))
  const bun = (globalThis as typeof globalThis & { Bun?: { readonly version: string } }).Bun
  const metadata = {
    architecture: process.arch,
    benchmarkSourceHash: hashFiles(benchmarkSourceFiles),
    bunLockHash: hash(readFileSync(join(repositoryRoot, "bun.lock"))),
    cpu: cpus()[0]?.model ?? "unknown",
    cpuGovernor: readSystemValue("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"),
    cpuSpeedMHz: cpus()[0]?.speed,
    caseOrder: selected.map((benchmark) => resultId(benchmark)),
    gitHead: git(["rev-parse", "HEAD"]).trim(),
    gitStatus: git(["status", "--porcelain=v2"]),
    libraryOrder: configuration.libraryOrder,
    mode: configuration.quick ? "quick" : "full",
    platform: process.platform,
    runtime: bun ? `Bun ${bun.version}` : `Node ${process.version}`,
    sampleCount: configuration.sampleCount,
    sampleDurationMilliseconds: configuration.sampleDurationMilliseconds,
    timestamp: new Date().toISOString(),
    trackedDiffHash: hash(git(["diff", "--binary", "HEAD"])),
    untrackedFiles: untracked.files,
    untrackedManifestHash: untracked.hash,
    warmupDurationMilliseconds: configuration.warmupDurationMilliseconds,
  }
  const scores = comparisonScores(results)

  if (configuration.json)
    console.log(JSON.stringify({ comparisonScores: scores, metadata, results }, null, 2))
  else {
    terminal.heading("Kern benchmarks")
    terminal.detail(
      "runtime",
      `${metadata.runtime} · ${metadata.platform} ${metadata.architecture}`,
    )
    terminal.detail("processor", metadata.cpu)
    terminal.detail("mode", metadata.mode)
    terminal.detail(
      "sampling",
      `${metadata.sampleCount} samples · ~${metadata.sampleDurationMilliseconds} ms each · ~${metadata.warmupDurationMilliseconds} ms warmup`,
    )
    console.log()
    printTable(results)
    for (const score of scores) printComparisonScore(score, configuration.quick)
    terminal.success(
      `${results.filter((result) => !("unsupported" in result)).length} benchmark cases completed`,
    )
  }

  void sink
}
