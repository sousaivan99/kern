import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { runWorkflow, type WorkflowStep } from "../shared/workflow.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const root = join(repositoryRoot, "packages", "kern")
const [repositoryLicense, packageLicense] = await Promise.all([
  readFile(join(repositoryRoot, "LICENSE"), "utf8"),
  readFile(join(root, "LICENSE"), "utf8"),
])
if (repositoryLicense !== packageLicense)
  throw new Error("packages/kern/LICENSE must match LICENSE")
const run = (...arguments_: string[]): readonly string[] => [process.execPath, "run", ...arguments_]
const steps: readonly WorkflowStep[] = [
  { command: run("build"), name: "Build package" },
  { command: [process.execPath, "x", "publint", "--strict"], name: "Package metadata" },
  {
    command: [process.execPath, join(repositoryRoot, "tooling/scripts/kern/package-types.ts")],
    name: "Package types",
  },
  {
    command: [process.execPath, join(repositoryRoot, "tooling/scripts/kern/package-smoke.ts")],
    name: "Installed package",
  },
  { command: run("pack:dry"), name: "Publish contents" },
]

await runWorkflow({ cwd: root, name: "package checks", steps })
