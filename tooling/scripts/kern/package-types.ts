import { join, resolve } from "node:path"
import { terminal } from "../shared/console.js"

const root = join(resolve(import.meta.dir, "../../.."), "packages", "kern")
const arguments_ = ["x", "attw", "--pack", ".", "--profile", "esm-only"]
const spawn = (quiet: boolean) =>
  Bun.spawnSync([process.execPath, ...arguments_, ...(quiet ? ["--quiet"] : [])], {
    cwd: root,
    stderr: "inherit",
    stdout: "inherit",
  })

const result = spawn(true)
if (result.exitCode !== 0) {
  terminal.error("Package type analysis failed; rerunning with diagnostics")
  const detailedResult = spawn(false)
  process.exit(detailedResult.exitCode || result.exitCode)
}

terminal.success("Package types support modern ESM and bundler resolution")
