import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { gzipSync } from "node:zlib"
import { type TableColumn, terminal } from "../shared/console.js"

interface Entry {
  readonly budgetBytes: number
  readonly id: string
}

interface SizeMeasurement {
  readonly budgetBytes: number
  readonly gzipBytes: number
  readonly id: string
  readonly import: string
  readonly rawBytes: number
}

interface ExampleMeasurement {
  readonly fixture: string
  readonly gzipBytes: number
  readonly id: string
  readonly label: string
  readonly package: string
  readonly rawBytes: number
  readonly source: string
  readonly version: string
}

interface SizeReport {
  readonly entrypoints: readonly SizeMeasurement[]
  readonly examples: readonly ExampleMeasurement[]
  readonly measurement: {
    readonly bunVersion: string
    readonly compression: "gzip, level 9"
    readonly format: "esm"
    readonly minified: true
    readonly target: "browser"
  }
  readonly rootEntrypoint: SizeMeasurement
  readonly schemaVersion: 1
}

const entries: readonly Entry[] = [
  { id: "validation", budgetBytes: 5 * 1024 },
  { id: "money", budgetBytes: 2.5 * 1024 },
  { id: "date", budgetBytes: 2 * 1024 },
  { id: "number", budgetBytes: 1_500 },
  { id: "array", budgetBytes: 1_500 },
  { id: "string", budgetBytes: 2 * 1024 },
  { id: "object", budgetBytes: 2 * 1024 },
  { id: "async", budgetBytes: 2_500 },
  { id: "index", budgetBytes: 16 * 1024 },
]

const repositoryRoot = resolve(import.meta.dir, "../../..")
const packageRoot = join(repositoryRoot, "packages", "kern")
const reportPath = join(repositoryRoot, "apps", "docs", "src", "data", "package-sizes.json")
const fixtureRoot = join(repositoryRoot, "tooling", "size-fixtures", "validation")

const arguments_ = new Set(process.argv.slice(2))
const knownArguments = new Set(["--check", "--json", "--write-report"])
for (const argument of arguments_) {
  if (!knownArguments.has(argument)) throw new Error(`Unknown size option: ${argument}`)
}
if (arguments_.has("--json") && arguments_.has("--write-report")) {
  throw new Error("--json and --write-report cannot be combined")
}

const check = arguments_.has("--check")
const json = arguments_.has("--json")
const writeReport = arguments_.has("--write-report")

const packageVersion = async (packagePath: string): Promise<string> => {
  const metadata = JSON.parse(await readFile(packagePath, "utf8")) as { readonly version?: unknown }
  if (typeof metadata.version !== "string") throw new Error(`${packagePath} has no package version`)
  return metadata.version
}

const measureBundle = async (
  source: string,
): Promise<{ readonly gzipBytes: number; readonly rawBytes: number }> => {
  const result = await Bun.build({
    entrypoints: [source],
    format: "esm",
    minify: true,
    target: "browser",
  })

  if (!result.success) {
    for (const log of result.logs) terminal.error(String(log))
    throw new Error(`Unable to measure ${relative(repositoryRoot, source)}`)
  }
  const output = result.outputs.find((candidate) => candidate.path.endsWith(".js"))
  if (!output) throw new Error(`No JavaScript output produced for ${source}`)
  const bytes = new Uint8Array(await output.arrayBuffer())
  return {
    gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
    rawBytes: bytes.byteLength,
  }
}

const entrypointMeasurements: SizeMeasurement[] = []
for (const entry of entries) {
  const source =
    entry.id === "index"
      ? join(packageRoot, "src", "index.ts")
      : join(packageRoot, "src", entry.id, "index.ts")
  const measurement = await measureBundle(source)
  entrypointMeasurements.push({
    ...measurement,
    budgetBytes: entry.budgetBytes,
    id: entry.id,
    import: entry.id === "index" ? "@sousaivan/kern" : `@sousaivan/kern/${entry.id}`,
  })
}

const packageVersions = {
  kern: await packageVersion(join(packageRoot, "package.json")),
  valibot: await packageVersion(
    join(repositoryRoot, "tooling", "node_modules", "valibot", "package.json"),
  ),
  zod: await packageVersion(join(repositoryRoot, "tooling", "node_modules", "zod", "package.json")),
} as const

const exampleDefinitions = [
  {
    id: "kern",
    label: "Kern",
    package: "@sousaivan/kern",
    version: packageVersions.kern,
  },
  { id: "zod", label: "Zod", package: "zod", version: packageVersions.zod },
  {
    id: "valibot",
    label: "Valibot",
    package: "valibot",
    version: packageVersions.valibot,
  },
] as const

const exampleMeasurements: ExampleMeasurement[] = []
for (const example of exampleDefinitions) {
  const fixturePath = join(fixtureRoot, `${example.id}.ts`)
  const source = await readFile(fixturePath, "utf8")
  const measurement = await measureBundle(fixturePath)
  exampleMeasurements.push({
    ...example,
    ...measurement,
    fixture: relative(repositoryRoot, fixturePath).split(sep).join("/"),
    source,
  })
}

const rootEntrypoint = entrypointMeasurements.find((entry) => entry.id === "index")
if (!rootEntrypoint) throw new Error("Root entrypoint measurement is missing")

const report: SizeReport = {
  schemaVersion: 1,
  measurement: {
    bunVersion: Bun.version,
    compression: "gzip, level 9",
    format: "esm",
    minified: true,
    target: "browser",
  },
  entrypoints: entrypointMeasurements.filter((entry) => entry.id !== "index"),
  rootEntrypoint,
  examples: exampleMeasurements,
}

const serializedReport = `${JSON.stringify(report, null, 2)}\n`
if (json) {
  process.stdout.write(serializedReport)
  process.exit(0)
}

if (writeReport) {
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, serializedReport)
}

type SizeRow = (typeof entrypointMeasurements)[number]
const columns: readonly TableColumn<SizeRow>[] = [
  { header: "entrypoint", style: "cyan", value: (row) => row.id },
  { align: "right", header: "raw", value: (row) => `${row.rawBytes} B` },
  {
    align: "right",
    header: "gzip",
    style: (row) => (row.gzipBytes <= row.budgetBytes ? "green" : "red"),
    value: (row) => `${row.gzipBytes} B`,
  },
  { align: "right", header: "budget", style: "dim", value: (row) => `${row.budgetBytes} B` },
  {
    header: "status",
    style: (row) => (row.gzipBytes <= row.budgetBytes ? "green" : "red"),
    value: (row) => (row.gzipBytes <= row.budgetBytes ? "within budget" : "over budget"),
  },
]

type ExampleRow = (typeof exampleMeasurements)[number]
const exampleColumns: readonly TableColumn<ExampleRow>[] = [
  { header: "library", style: "cyan", value: (row) => `${row.label} ${row.version}` },
  { align: "right", header: "raw", value: (row) => `${row.rawBytes} B` },
  { align: "right", header: "gzip", style: "green", value: (row) => `${row.gzipBytes} B` },
]

terminal.heading("Bundle sizes")
terminal.table(entrypointMeasurements, columns)
terminal.heading("Realistic validation schema")
terminal.table(exampleMeasurements, exampleColumns)

const failures = entrypointMeasurements.filter((row) => row.gzipBytes > row.budgetBytes)
let reportIsCurrent = true
if (check) {
  const existingReport = await readFile(reportPath, "utf8").catch(() => undefined)
  reportIsCurrent = existingReport === serializedReport
  if (!reportIsCurrent)
    terminal.error("Documentation size report is stale; run bun run size:report")
}

if (writeReport) terminal.success(`Updated ${relative(repositoryRoot, reportPath)}`)
if (failures.length === 0) terminal.success("All entrypoints are within their gzip budgets")
else terminal.error(`Bundle-size budget exceeded by: ${failures.map((row) => row.id).join(", ")}`)

if (failures.length > 0 || (check && !reportIsCurrent)) process.exit(1)
