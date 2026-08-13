import { join, resolve } from "node:path"
import { runWorkflow } from "../shared/workflow.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const docsRoot = join(repositoryRoot, "apps", "docs")

await runWorkflow({
  cwd: docsRoot,
  name: "documentation checks",
  steps: [
    { command: [process.execPath, "run", "typecheck"], name: "Astro typecheck" },
    { command: [process.execPath, "run", "snippets"], name: "TypeScript snippets" },
    { command: [process.execPath, "run", "build"], name: "Static build and API reference" },
    { command: [process.execPath, "run", "a11y"], name: "Accessibility and contrast" },
    { command: [process.execPath, "run", "test:browser"], name: "Browser smoke test" },
  ],
})
