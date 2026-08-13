import { copyFile, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { terminal } from "../shared/console.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const root = join(repositoryRoot, "packages", "kern")
const temporaryDirectory = await mkdtemp(join(tmpdir(), "kern-package-smoke-"))

try {
  const packed = Bun.spawnSync(
    [process.execPath, "pm", "pack", "--destination", temporaryDirectory, "--ignore-scripts"],
    { cwd: root, stderr: "inherit", stdout: "inherit" },
  )
  if (packed.exitCode !== 0) process.exit(packed.exitCode)

  const tarballName = (await readdir(temporaryDirectory)).find((name) => name.endsWith(".tgz"))
  if (!tarballName) throw new Error("Package smoke test could not find the packed tarball")
  const tarball = join(temporaryDirectory, tarballName)

  await writeFile(
    join(temporaryDirectory, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  )
  await copyFile(
    join(root, "tests", "compat", "package-smoke.mjs"),
    join(temporaryDirectory, "package-smoke.mjs"),
  )

  const installed = Bun.spawnSync([process.execPath, "add", tarball], {
    cwd: temporaryDirectory,
    stderr: "inherit",
    stdout: "inherit",
  })
  if (installed.exitCode !== 0) process.exit(installed.exitCode)

  const executed = Bun.spawnSync(["node", "package-smoke.mjs"], {
    cwd: temporaryDirectory,
    stderr: "inherit",
    stdout: "inherit",
  })
  if (executed.exitCode !== 0) process.exit(executed.exitCode)
  terminal.success("Packed package smoke test passed")
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true })
}
