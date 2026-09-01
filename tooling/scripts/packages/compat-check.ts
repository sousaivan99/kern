import { join, resolve } from "node:path"
import { packageManifest } from "../shared/packages.js"
import { runWorkflow, type WorkflowStep } from "../shared/workflow.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const reuseBuild = process.argv.includes("--reuse-build")
const universalPackages = packageManifest.packages.filter(({ runtime }) => runtime === "universal")
const smoke = join(repositoryRoot, "tooling", "fixtures", "compat", "runtime-smoke.mjs")
const steps: WorkflowStep[] = [
  ...(reuseBuild
    ? []
    : [
        {
          command: [process.execPath, "tooling/scripts/packages/build.ts"],
          name: "Build packages",
        },
      ]),
]

for (const runtime of [process.execPath, "node"] as const) {
  steps.push({
    command: [
      runtime,
      smoke,
      ...universalPackages.map(({ directory }) => join(repositoryRoot, directory, "dist")),
    ],
    name: `${runtime === "node" ? "Node" : "Bun"} runtime`,
  })
}

await runWorkflow({ cwd: repositoryRoot, name: "runtime compatibility checks", steps })
