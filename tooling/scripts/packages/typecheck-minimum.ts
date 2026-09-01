import { join, resolve } from "node:path"
import { packageManifest } from "../shared/packages.js"
import { runWorkflow } from "../shared/workflow.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
await runWorkflow({
  cwd: repositoryRoot,
  name: "TypeScript 5 minimum",
  steps: packageManifest.packages.map((definition) => ({
    name: definition.name,
    command: [
      process.execPath,
      join(repositoryRoot, "tooling/node_modules/typescript-5/bin/tsc"),
      "--noEmit",
      "--project",
      join(repositoryRoot, definition.directory, "tsconfig.json"),
    ],
  })),
})
