import { rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { progress } from "@clack/prompts"
import { terminal } from "../shared/console.js"
import { printCapturedFailure, runCaptured } from "../shared/process.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const packageRoot = join(repositoryRoot, "packages", "kern")
const outputDirectory = join(packageRoot, "dist")
const modules = ["validation", "money", "date", "number", "string", "array", "object", "async"]
const entrypoints = ["", ...modules]
const bar = progress({ max: entrypoints.length + 1, size: 32, style: "block" })

await rm(outputDirectory, { force: true, recursive: true })
bar.start(`0/${entrypoints.length + 1} · Preparing build`)

for (let index = 0; index < entrypoints.length; index += 1) {
  const moduleName = entrypoints[index] as string
  const label = moduleName || "root"
  bar.message(`${index}/${entrypoints.length + 1} · Bundling ${label}`)
  const source = moduleName
    ? join(packageRoot, "src", moduleName, "index.ts")
    : join(packageRoot, "src", "index.ts")
  const outdir = moduleName ? join(outputDirectory, moduleName) : outputDirectory
  const result = await Bun.build({
    entrypoints: [source],
    outdir,
    format: "esm",
    target: "browser",
    sourcemap: "external",
    minify: false,
    splitting: false,
  })

  if (!result.success) {
    bar.error(`Failed to bundle ${label}`)
    for (const log of result.logs) terminal.error(String(log))
    throw new Error(`Failed to build ${moduleName || "root"} entrypoint`)
  }
  bar.advance(1, `${index + 1}/${entrypoints.length + 1} · Bundled ${label}`)
}

bar.message(`${entrypoints.length}/${entrypoints.length + 1} · Generating declarations`)
const declarations = await runCaptured(
  [process.execPath, "x", "tsc", "--project", join(packageRoot, "tsconfig.build.json")],
  { cwd: repositoryRoot },
)

if (declarations.exitCode !== 0) {
  bar.error("Declaration generation failed")
  printCapturedFailure(declarations)
  process.exit(declarations.exitCode)
}

bar.advance(1, `${entrypoints.length + 1}/${entrypoints.length + 1} · Declarations generated`)
bar.stop(`Built ${modules.length + 1} ESM entrypoints with declarations and source maps`)
