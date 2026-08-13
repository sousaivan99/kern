import { rm } from "node:fs/promises"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const outputDirectory = join(root, "dist")
const modules = ["validation", "money", "date", "number", "string", "array", "object", "async"]

await rm(outputDirectory, { force: true, recursive: true })

for (const moduleName of ["", ...modules]) {
  const source = moduleName
    ? join(root, "src", moduleName, "index.ts")
    : join(root, "src", "index.ts")
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
    for (const log of result.logs) console.error(log)
    throw new Error(`Failed to build ${moduleName || "root"} entrypoint`)
  }
}

const declarations = Bun.spawnSync(
  [process.execPath, "x", "tsc", "--project", join(root, "tsconfig.build.json")],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
)

if (declarations.exitCode !== 0) process.exit(declarations.exitCode)

console.log(`Built ${modules.length + 1} ESM entrypoints with declarations and source maps.`)
