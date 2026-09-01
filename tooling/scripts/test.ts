import { resolve } from "node:path"
import { runWorkflow } from "./shared/workflow.js"

const repositoryRoot = resolve(import.meta.dir, "../..")

await runWorkflow({
  cwd: repositoryRoot,
  name: "test suites",
  steps: [
    { command: [process.execPath, "test", "packages"], name: "Lithekit packages" },
    { command: [process.execPath, "--filter", "@lithekit/tooling", "test"], name: "Tooling" },
  ],
})
