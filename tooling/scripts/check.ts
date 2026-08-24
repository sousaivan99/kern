import { resolve } from "node:path"
import { runWorkflow, type WorkflowStep } from "./shared/workflow.js"

const root = resolve(import.meta.dir, "../..")
const run = (...arguments_: string[]): readonly string[] => [process.execPath, "run", ...arguments_]
const script = (...path: string[]): readonly string[] => [process.execPath, ...path]

const afterBuild = ["kern-build"] as const
const steps: readonly WorkflowStep[] = [
  { command: run("lint"), id: "lint", name: "Lint", warningOutput: "full" },
  { command: run("typecheck"), id: "typecheck", name: "TypeScript current" },
  { command: run("typecheck:minimum"), id: "typecheck-minimum", name: "TypeScript minimum" },
  { command: run("test:coverage"), id: "coverage", name: "Tests and coverage" },
  { command: run("test:fuzz"), id: "fuzz", name: "Seeded property and fuzz tests" },
  {
    command: [process.execPath, "--filter", "@kern/tooling", "test"],
    id: "tooling-tests",
    name: "Tooling tests",
  },
  { command: run("audit"), id: "audit", name: "Dependency audit" },
  { command: run("build:kern"), id: "kern-build", name: "Package build" },
  {
    command: script("tooling/scripts/kern/module-check.ts", "--built"),
    dependsOn: afterBuild,
    id: "modules",
    name: "Module manifest",
  },
  {
    command: run("size:check"),
    dependsOn: afterBuild,
    id: "size",
    name: "Bundle budgets",
  },
  {
    command: run("benchmark:quick"),
    dependsOn: afterBuild,
    id: "benchmark",
    name: "Benchmark smoke",
  },
  {
    command: run("test:timezones"),
    dependsOn: afterBuild,
    id: "timezones",
    name: "Timezone matrix",
  },
  {
    command: script("tooling/scripts/kern/compat-check.ts", "--reuse-build"),
    dependsOn: afterBuild,
    id: "compatibility",
    name: "Runtime compatibility",
  },
  {
    command: script("tooling/scripts/kern/browser-check.ts", "--reuse-build"),
    dependsOn: afterBuild,
    id: "browser",
    name: "Browser compatibility",
  },
  {
    command: run("test:frameworks"),
    dependsOn: afterBuild,
    id: "frameworks",
    name: "Framework tutorials",
  },
  {
    command: script("tooling/scripts/kern/package-check.ts", "--reuse-build"),
    dependsOn: afterBuild,
    id: "package",
    name: "Packed package",
  },
  {
    command: script("tooling/scripts/docs/check.ts", "--reuse-typecheck"),
    dependsOn: ["kern-build", "typecheck"],
    id: "docs",
    name: "Documentation",
  },
]

await runWorkflow({ cwd: root, maxConcurrency: 4, name: "release checks", steps })
