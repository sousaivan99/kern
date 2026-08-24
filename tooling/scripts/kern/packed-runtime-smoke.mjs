import { spawnSync } from "node:child_process"
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const runtime = process.argv.find((argument) => argument.startsWith("--runtime="))?.slice(10)
const tarballArgument = process.argv
  .find((argument) => argument.startsWith("--tarball="))
  ?.slice(10)

if (!runtime || !["node", "bun", "deno"].includes(runtime)) {
  throw new Error("Expected --runtime=node, --runtime=bun, or --runtime=deno")
}
if (!tarballArgument) throw new Error("Expected --tarball=<path>")

const tarball = resolve(tarballArgument)
const temporaryDirectory = await mkdtemp(join(tmpdir(), `kern-${runtime}-packed-`))
const packageRoot = join(temporaryDirectory, "node_modules", "@sousaivan", "kern")

try {
  await mkdir(packageRoot, { recursive: true })
  await writeFile(
    join(temporaryDirectory, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  )
  await copyFile(
    join(repositoryRoot, "packages/kern/tests/compat/package-smoke.mjs"),
    join(temporaryDirectory, "package-smoke.mjs"),
  )

  const extracted = spawnSync("tar", ["-xzf", tarball, "--strip-components=1", "-C", packageRoot], {
    stdio: "inherit",
  })
  if (extracted.status !== 0) process.exit(extracted.status ?? 1)

  const commands = {
    bun: ["bun", "package-smoke.mjs"],
    deno: ["deno", "run", "--allow-read", "--node-modules-dir=manual", "package-smoke.mjs"],
    node: ["node", "package-smoke.mjs"],
  }
  const [executable, ...arguments_] = commands[runtime]
  const executed = spawnSync(executable, arguments_, {
    cwd: temporaryDirectory,
    stdio: "inherit",
  })
  if (executed.status !== 0) process.exit(executed.status ?? 1)
  console.log(`${basename(tarball)} passed the ${runtime} installed-package smoke test`)
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true })
}
