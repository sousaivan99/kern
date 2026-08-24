import { join, resolve } from "node:path"
import { runWorkflow, type WorkflowStep } from "../shared/workflow.js"

const root = join(resolve(import.meta.dir, "../../.."), "packages", "kern")
const reuseBuild = process.argv.includes("--reuse-build")
const steps: readonly WorkflowStep[] = [
  ...(reuseBuild ? [] : [{ command: [process.execPath, "run", "build"], name: "Build package" }]),
  {
    command: [process.execPath, "tests/compat/runtime-smoke.mjs"],
    name: "Bun runtime",
  },
  { command: ["node", "tests/compat/runtime-smoke.mjs"], name: "Node runtime" },
]

await runWorkflow({ cwd: root, name: "runtime compatibility checks", steps })
