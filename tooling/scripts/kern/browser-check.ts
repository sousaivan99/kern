import { resolve } from "node:path"
import { runWorkflow, type WorkflowStep } from "../shared/workflow.js"

const root = resolve(import.meta.dir, "../../..")
const steps: readonly WorkflowStep[] = [
  { command: [process.execPath, "run", "build"], name: "Build package" },
  {
    command: [process.execPath, "tooling/scripts/kern/browser-smoke.ts"],
    name: "Chromium smoke test",
  },
]

await runWorkflow({ cwd: root, name: "browser compatibility checks", steps })
