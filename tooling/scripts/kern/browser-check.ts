import { resolve } from "node:path"
import { runWorkflow, type WorkflowStep } from "../shared/workflow.js"

const root = resolve(import.meta.dir, "../../..")
const reuseBuild = process.argv.includes("--reuse-build")
const browserArgument = process.argv.find((argument) => argument.startsWith("--browser="))
const steps: readonly WorkflowStep[] = [
  ...(reuseBuild
    ? []
    : [{ command: [process.execPath, "run", "build:kern"], name: "Build package" }]),
  {
    command: [
      process.execPath,
      "tooling/scripts/kern/browser-smoke.ts",
      ...(browserArgument ? [browserArgument] : []),
    ],
    name: `${browserArgument?.slice(10) ?? "Chromium"} smoke test`,
  },
]

await runWorkflow({ cwd: root, name: "browser compatibility checks", steps })
