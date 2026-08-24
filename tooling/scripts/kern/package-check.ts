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
const reuseBuild = process.argv.includes("--reuse-build")
const tarballOutputArgument = process.argv.find((argument) =>
  argument.startsWith("--tarball-output="),
)
const tarballOutput = tarballOutputArgument
  ? `--tarball-output=${resolve(repositoryRoot, tarballOutputArgument.slice("--tarball-output=".length))}`
  : undefined
const steps: readonly WorkflowStep[] = [
  ...(reuseBuild ? [] : [{ command: run("build"), name: "Build package" }]),
  {
    command: [process.execPath, join(repositoryRoot, "tooling/scripts/kern/package-types.ts")],
    name: "Package types",
  },
  {
    command: [
      process.execPath,
      join(repositoryRoot, "tooling/scripts/kern/package-smoke.ts"),
      ...(tarballOutput ? [tarballOutput] : []),
    ],
    name: "Installed package",
  },
  { command: run("pack:dry"), name: "Publish contents" },
]

await runWorkflow({ cwd: root, name: "package checks", steps })
