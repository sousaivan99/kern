import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { gzipSync } from "node:zlib"
import { type TableColumn, terminal } from "../shared/console.js"
import { type PackageDefinition, packageById, packageManifest } from "../shared/packages.js"
import { selectedPackageId } from "./arguments.js"

interface Measurement {
  readonly budgetBytes: number
  readonly gzipBytes: number
  readonly id: string
  readonly import: string
  readonly rawBytes: number
}

const repositoryRoot = resolve(import.meta.dir, "../../..")
const reportPath = join(repositoryRoot, "apps/docs/src/data/package-sizes.json")
const arguments_ = new Set(
  process.argv.slice(2).filter((argument) => !argument.startsWith("--package=")),
)
const knownArguments = new Set(["--check", "--json", "--write-report"])
for (const argument of arguments_)
  if (!knownArguments.has(argument)) throw new Error(`Unknown size option: ${argument}`)
const selected = selectedPackageId()
const definitions = selected ? [packageById(selected)] : packageManifest.packages

const measure = async (
  source: string,
  external: readonly string[] = [],
): Promise<{ readonly gzipBytes: number; readonly rawBytes: number }> => {
  const result = await Bun.build({
    entrypoints: [source],
    external: [...external],
    format: "esm",
    minify: true,
    target: "browser",
  })
  if (!result.success) {
    for (const log of result.logs) terminal.error(String(log))
    throw new Error(`Unable to measure ${relative(repositoryRoot, source)}`)
  }
  const output = result.outputs.find((candidate) => candidate.path.endsWith(".js"))
  if (!output) throw new Error(`No JavaScript output for ${source}`)
  const bytes = new Uint8Array(await output.arrayBuffer())
  return { gzipBytes: gzipSync(bytes, { level: 9 }).byteLength, rawBytes: bytes.byteLength }
}

const frameworkExternals = (definition: PackageDefinition): readonly string[] =>
  definition.externals?.filter((name) => name !== "@lithekit/form") ?? []

const packages: Measurement[] = []
for (const definition of definitions) {
  const source = join(repositoryRoot, definition.directory, "src/index.ts")
  packages.push({
    ...(await measure(source, frameworkExternals(definition))),
    budgetBytes: definition.gzipBudgetBytes,
    id: definition.id,
    import: definition.name,
  })
}

const formValidation = selected
  ? undefined
  : await measure(join(repositoryRoot, "tooling/size-fixtures/form/validation.ts"))
const report = {
  schemaVersion: 2,
  measurement: {
    bunVersion: Bun.version,
    compression: "gzip, level 9",
    format: "esm",
    minified: true,
    target: "browser",
  },
  packages,
  fixtures: formValidation
    ? [
        {
          id: "form-validation",
          label: "Form with Lithekit Validation",
          budgetBytes: 16_384,
          fixture: relative(
            repositoryRoot,
            join(repositoryRoot, "tooling/size-fixtures/form/validation.ts"),
          )
            .split(sep)
            .join("/"),
          ...formValidation,
        },
      ]
    : [],
}
const serialized = `${JSON.stringify(report, null, 2)}\n`
if (arguments_.has("--json")) process.stdout.write(serialized)

const columns: readonly TableColumn<Measurement>[] = [
  { header: "package", style: "cyan", value: (row) => row.import },
  { align: "right", header: "raw", value: (row) => `${row.rawBytes} B` },
  {
    align: "right",
    header: "gzip",
    style: (row) => (row.gzipBytes <= row.budgetBytes ? "green" : "red"),
    value: (row) => `${row.gzipBytes} B`,
  },
  { align: "right", header: "budget", style: "dim", value: (row) => `${row.budgetBytes} B` },
]
if (!arguments_.has("--json")) {
  terminal.heading("Lithekit package sizes")
  terminal.table(packages, columns)
  if (formValidation)
    terminal.detail("form+validation", `${formValidation.gzipBytes} B gzip / 16384 B`)
}

if (arguments_.has("--write-report")) {
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, serialized)
}
const failures = packages.filter((measurement) => measurement.gzipBytes > measurement.budgetBytes)
if (formValidation && formValidation.gzipBytes > 16_384)
  failures.push({
    ...formValidation,
    budgetBytes: 16_384,
    id: "form-validation",
    import: "fixture",
  })
let reportCurrent = true
if (arguments_.has("--check") && !selected) {
  reportCurrent = (await readFile(reportPath, "utf8").catch(() => undefined)) === serialized
  if (!reportCurrent) terminal.error("Documentation size report is stale; run bun run size:report")
}
if (failures.length > 0 || !reportCurrent) process.exitCode = 1
