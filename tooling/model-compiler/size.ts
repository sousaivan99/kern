import { relative } from "node:path"
import { gzipSync } from "node:zlib"

interface Measurement {
  readonly gzipBytes: number
  readonly name: string
  readonly rawBytes: number
}

const fixtures = [
  ["runtime User", "size-fixtures/runtime-user.ts"],
  ["compiled User", "size-fixtures/compiled-user.ts"],
  ["runtime advanced User", "size-fixtures/runtime-advanced-user.ts"],
  ["compiled advanced User", "size-fixtures/compiled-advanced-user.ts"],
] as const

const measurements: Measurement[] = []
for (const [name, fixture] of fixtures) {
  const source = new URL(fixture, import.meta.url).pathname
  const result = await Bun.build({
    entrypoints: [source],
    format: "esm",
    minify: true,
    target: "browser",
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    throw new Error(`Unable to bundle ${relative(process.cwd(), source)}`)
  }
  const output = result.outputs.find((candidate) => candidate.path.endsWith(".js"))
  if (!output) throw new Error(`No JavaScript bundle was generated for ${fixture}`)
  const bytes = new Uint8Array(await output.arrayBuffer())
  measurements.push({
    gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
    name,
    rawBytes: bytes.byteLength,
  })
}

console.table(measurements)
