import { join, resolve } from "node:path"
import { packageManifest } from "../shared/packages.js"
import { runWorkflow } from "../shared/workflow.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
await runWorkflow({
  cwd: repositoryRoot,
  name: "package dry runs",
  steps: packageManifest.packages.map((definition) => ({
    name: definition.name,
    command: [
      process.execPath,
      "--cwd",
      join(repositoryRoot, definition.directory),
      "pm",
      "pack",
      "--dry-run",
    ],
  })),
})
