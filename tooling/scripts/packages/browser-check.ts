import { resolve } from "node:path"
import { runWorkflow, type WorkflowStep } from "../shared/workflow.js"

const root = resolve(import.meta.dir, "../../..")
const reuseBuild = process.argv.includes("--reuse-build")
const browserArgument = process.argv.find((argument) => argument.startsWith("--browser="))
const steps: readonly WorkflowStep[] = [
  ...(reuseBuild
    ? []
    : [
        {
          command: [process.execPath, "tooling/scripts/packages/build.ts", "--package=form"],
          name: "Build Form",
        },
      ]),
  {
    command: [
      process.execPath,
      "tooling/scripts/packages/browser-smoke.ts",
      ...(browserArgument ? [browserArgument] : []),
    ],
    name: `${browserArgument?.slice(10) ?? "Chromium"} Form smoke test`,
  },
  {
    command: [
      process.execPath,
      "tooling/scripts/packages/adapter-browser-smoke.ts",
      ...(browserArgument ? [browserArgument] : []),
    ],
    name: `${browserArgument?.slice(10) ?? "Chromium"} adapter smoke test`,
  },
]

await runWorkflow({ cwd: root, name: "browser compatibility checks", steps })
