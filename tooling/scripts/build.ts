import { resolve } from "node:path"
import { runWorkflow } from "./shared/workflow.js"

const repositoryRoot = resolve(import.meta.dir, "../..")
const run = (...arguments_: string[]): readonly string[] => [process.execPath, "run", ...arguments_]

await runWorkflow({
  cwd: repositoryRoot,
  name: "workspace builds",
  steps: [
    { command: run("build:kern"), name: "Kern package" },
    { command: run("build:docs"), name: "Documentation site" },
  ],
})
