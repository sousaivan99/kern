import { rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { terminal } from "../shared/console.js"
import { packageById, packageManifest } from "../shared/packages.js"
import { printCapturedFailure, runCaptured } from "../shared/process.js"
import { selectedPackageId } from "./arguments.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const selected = selectedPackageId()
const definitions = selected ? [packageById(selected)] : packageManifest.packages

for (const definition of definitions) {
  const packageRoot = join(repositoryRoot, definition.directory)
  const outputDirectory = join(packageRoot, "dist")
  await rm(outputDirectory, { force: true, recursive: true })
  terminal.info(`Building ${definition.name}`)

  const result = await Bun.build({
    entrypoints: [join(packageRoot, "src", "index.ts")],
    outdir: outputDirectory,
    external: [...(definition.externals ?? [])],
    format: "esm",
    target: "browser",
    sourcemap: "external",
    minify: false,
    splitting: false,
  })
  if (!result.success) {
    for (const log of result.logs) terminal.error(String(log))
    throw new Error(`Failed to bundle ${definition.name}`)
  }

  const declarations = await runCaptured(
    [process.execPath, "x", "tsc", "--project", join(packageRoot, "tsconfig.build.json")],
    { cwd: repositoryRoot },
  )
  if (declarations.exitCode !== 0) {
    printCapturedFailure(declarations)
    throw new Error(`Failed to generate declarations for ${definition.name}`)
  }
  terminal.success(`Built ${definition.name}`)
}
