import { join, resolve } from "node:path"
import { gzipSync } from "node:zlib"
import { type TableColumn, terminal } from "../shared/console.js"

interface Entry {
  readonly name: string
  readonly budget: number
}

const entries: readonly Entry[] = [
  { name: "validation", budget: 5 * 1024 },
  { name: "money", budget: 2.5 * 1024 },
  { name: "date", budget: 2 * 1024 },
  { name: "number", budget: 1_500 },
  { name: "array", budget: 1_500 },
  { name: "string", budget: 2 * 1024 },
  { name: "object", budget: 2 * 1024 },
  { name: "async", budget: 2_500 },
  { name: "index", budget: 16 * 1024 },
]

const root = join(resolve(import.meta.dir, "../../.."), "packages", "kern")
const check = process.argv.includes("--check")
const rows: Array<{ name: string; raw: number; gzip: number; budget: number }> = []

for (const entry of entries) {
  const source =
    entry.name === "index"
      ? join(root, "src", "index.ts")
      : join(root, "src", entry.name, "index.ts")
  const result = await Bun.build({
    entrypoints: [source],
    format: "esm",
    target: "browser",
    minify: true,
  })

  if (!result.success) throw new Error(`Unable to measure ${entry.name}`)
  const output = result.outputs.find((candidate) => candidate.path.endsWith(".js"))
  if (!output) throw new Error(`No JavaScript output produced for ${entry.name}`)
  const bytes = new Uint8Array(await output.arrayBuffer())
  rows.push({
    name: entry.name,
    raw: bytes.byteLength,
    gzip: gzipSync(bytes).byteLength,
    budget: entry.budget,
  })
}

type SizeRow = (typeof rows)[number]
const columns: readonly TableColumn<SizeRow>[] = [
  { header: "entrypoint", style: "cyan", value: (row) => row.name },
  { align: "right", header: "raw", value: (row) => `${row.raw} B` },
  {
    align: "right",
    header: "gzip",
    style: (row) => (row.gzip <= row.budget ? "green" : "red"),
    value: (row) => `${row.gzip} B`,
  },
  { align: "right", header: "budget", style: "dim", value: (row) => `${row.budget} B` },
  {
    header: "status",
    style: (row) => (row.gzip <= row.budget ? "green" : "red"),
    value: (row) => (row.gzip <= row.budget ? "within budget" : "over budget"),
  },
]

terminal.heading("Bundle sizes")
terminal.table(rows, columns)

const failures = rows.filter((row) => row.gzip > row.budget)
if (check && failures.length > 0) {
  terminal.error(`Bundle-size budget exceeded by: ${failures.map((row) => row.name).join(", ")}`)
  process.exit(1)
}
if (failures.length === 0) terminal.success("All entrypoints are within their gzip budgets")
else terminal.warning(`${failures.length} entrypoint(s) exceed their gzip budgets`)
