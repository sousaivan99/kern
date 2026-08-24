import { join, resolve } from "node:path"
import { runWorkflow, type WorkflowStep } from "../shared/workflow.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const docsRoot = join(repositoryRoot, "apps", "docs")
const reuseTypecheck = process.argv.includes("--reuse-typecheck")
const steps: WorkflowStep[] = []

if (!reuseTypecheck) {
  steps.push({
    command: [process.execPath, "run", "typecheck"],
    id: "typecheck",
    name: "Astro typecheck",
  })
}
steps.push(
  {
    command: [process.execPath, "run", "snippets"],
    id: "snippets",
    name: "TypeScript snippets",
  },
  {
    command: [process.execPath, "run", "build"],
    dependsOn: reuseTypecheck ? ["snippets"] : ["typecheck", "snippets"],
    id: "build",
    name: "Static build and API reference",
  },
  {
    command: [process.execPath, "run", "a11y"],
    dependsOn: ["build"],
    id: "a11y",
    name: "Accessibility and contrast",
  },
  {
    command: [process.execPath, "run", "test:browser"],
    dependsOn: ["build"],
    id: "browser",
    name: "Browser smoke test",
  },
)

await runWorkflow({ cwd: docsRoot, maxConcurrency: 2, name: "documentation checks", steps })
