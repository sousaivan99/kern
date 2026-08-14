import { cpus } from "node:os"
import packageMetadata from "../../packages/kern/package.json"
import { type TableColumn, terminal } from "../scripts/shared/console.js"

export interface BenchmarkCase {
  readonly itemsPerOperation?: number
  readonly library?: string
  readonly libraryVersion?: string
  readonly name: string
  readonly prepareBatch?: (iterations: number) => () => unknown
  readonly run: () => unknown
  readonly size?: number
  readonly suite: string
  readonly unit?: string
  readonly verify?: (result: unknown) => void
}

export interface UnsupportedBenchmarkCase {
  readonly library: string
  readonly libraryVersion: string
  readonly name: string
  readonly suite: string
  readonly unsupported: string
}

export type BenchmarkDefinition = BenchmarkCase | UnsupportedBenchmarkCase

interface BenchmarkConfiguration {
  readonly json: boolean
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
  readonly itemsPerOperation?: number
  readonly library: string
  readonly libraryVersion: string
  readonly name: string
  readonly size?: number
  readonly statistics: BenchmarkStatistics
  readonly suite: string
  readonly unit?: string
}

interface UnsupportedBenchmarkResult extends UnsupportedBenchmarkCase {}

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

const percentile = (sortedValues: readonly number[], percentage: number): number => {
  const index = Math.max(0, Math.ceil(sortedValues.length * percentage) - 1)
  return sortedValues[index] ?? 0
}

const parseArguments = (): BenchmarkConfiguration => {
  const arguments_ = process.argv.slice(2)
  let json = false
  let quick = false
  let suite: string | undefined

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument === "--json") json = true
    else if (argument === "--quick") quick = true
    else if (argument === "--suite") {
      suite = arguments_[index + 1]
      index += 1
    } else if (argument?.startsWith("--suite=")) suite = argument.slice("--suite=".length)
    else throw new Error(`Unknown benchmark option: ${argument}`)
  }

  if (suite === "") throw new Error("--suite requires a non-empty suite name")
  const timing = quick ? quickConfiguration : fullConfiguration
  return {
    json,
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
  let iterations = 1
  while (iterations < 10_000_000) {
    const elapsed = measureBatch(benchmark, iterations)
    if (elapsed >= targetMilliseconds * 0.75) return iterations
    const multiplier = Math.min(
      10,
      Math.max(2, Math.floor(targetMilliseconds / Math.max(elapsed, 0.001))),
    )
    iterations = Math.min(10_000_000, iterations * multiplier)
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
  const medianMilliseconds = percentile(samples, 0.5)
  const nanosecondsPerOperation = (medianMilliseconds * 1_000_000) / iterations
  const itemsPerOperation = benchmark.itemsPerOperation ?? benchmark.size
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
  if (itemsPerOperation !== undefined) {
    return {
      ...(benchmark.itemsPerOperation === undefined
        ? {}
        : { itemsPerOperation: benchmark.itemsPerOperation }),
      library,
      libraryVersion,
      name: benchmark.name,
      ...(benchmark.size === undefined ? {} : { size: benchmark.size }),
      statistics: {
        ...statistics,
        nanosecondsPerItem: nanosecondsPerOperation / itemsPerOperation,
      },
      suite: benchmark.suite,
      ...(benchmark.unit === undefined ? {} : { unit: benchmark.unit }),
    }
  }
  return {
    ...(benchmark.itemsPerOperation === undefined
      ? {}
      : { itemsPerOperation: benchmark.itemsPerOperation }),
    library,
    libraryVersion,
    name: benchmark.name,
    statistics,
    suite: benchmark.suite,
    ...(benchmark.unit === undefined ? {} : { unit: benchmark.unit }),
  }
}

const formatCount = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)

const formatDuration = (nanoseconds: number): string => {
  if (nanoseconds < 1_000) return `${nanoseconds.toFixed(1)} ns`
  if (nanoseconds < 1_000_000) return `${(nanoseconds / 1_000).toFixed(2)} us`
  return `${(nanoseconds / 1_000_000).toFixed(2)} ms`
}

const printTable = (results: readonly ReportedBenchmarkResult[]): void => {
  const columns: readonly TableColumn<ReportedBenchmarkResult>[] = [
    {
      header: "suite",
      style: (result) => (result.suite === "validation" ? "magenta" : "cyan"),
      value: (result) => result.suite,
    },
    { header: "library", style: "cyan", value: (result) => result.library },
    { header: "version", style: "dim", value: (result) => result.libraryVersion },
    { header: "benchmark", value: (result) => result.name },
    {
      align: "right",
      header: "size",
      style: "dim",
      value: (result) =>
        "unsupported" in result || result.size === undefined ? "—" : formatCount(result.size),
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
      header: "time/item",
      style: "cyan",
      value: (result) =>
        "unsupported" in result || result.statistics.nanosecondsPerItem === undefined
          ? "—"
          : formatDuration(result.statistics.nanosecondsPerItem),
    },
  ]
  terminal.table(results, columns)
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Benchmark verification failed: ${message}`)
}

export const runBenchmarks = (benchmarks: readonly BenchmarkDefinition[]): void => {
  const configuration = parseArguments()
  const selected = configuration.suite
    ? benchmarks.filter((benchmark) => benchmark.suite === configuration.suite)
    : benchmarks
  if (selected.length === 0) {
    const suites = [...new Set(benchmarks.map((benchmark) => benchmark.suite))].join(", ")
    throw new Error(`No benchmarks found for suite ${configuration.suite}. Available: ${suites}`)
  }

  const results: ReportedBenchmarkResult[] = selected.map((benchmark) =>
    "unsupported" in benchmark ? benchmark : measure(benchmark, configuration),
  )
  const metadata = {
    architecture: process.arch,
    cpu: cpus()[0]?.model ?? "unknown",
    caseOrder: selected.map(
      (benchmark) => `${benchmark.suite}:${benchmark.name}:${benchmark.library ?? "Kern"}`,
    ),
    mode: configuration.quick ? "quick" : "full",
    platform: process.platform,
    runtime: `Bun ${Bun.version}`,
    sampleCount: configuration.sampleCount,
    sampleDurationMilliseconds: configuration.sampleDurationMilliseconds,
    timestamp: new Date().toISOString(),
    warmupDurationMilliseconds: configuration.warmupDurationMilliseconds,
  }

  if (configuration.json) console.log(JSON.stringify({ metadata, results }, null, 2))
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
    terminal.success(
      `${results.filter((result) => !("unsupported" in result)).length} benchmark cases completed`,
    )
  }

  void sink
}
