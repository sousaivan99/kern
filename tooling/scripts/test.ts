import { resolve } from "node:path"
import { runWorkflow } from "./shared/workflow.js"

const repositoryRoot = resolve(import.meta.dir, "../..")

await runWorkflow({
  cwd: repositoryRoot,
  name: "test suites",
  steps: [
    { command: [process.execPath, "--filter", "@kern/core", "test"], name: "Kern" },
    { command: [process.execPath, "--filter", "@kern/tooling", "test"], name: "Tooling" },
  ],
})
