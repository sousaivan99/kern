import { resolve } from "node:path"
import { runWorkflow, type WorkflowStep } from "./shared/workflow.js"

const root = resolve(import.meta.dir, "../..")
const run = (...arguments_: string[]): readonly string[] => [process.execPath, "run", ...arguments_]
const steps: readonly WorkflowStep[] = [
  { command: run("lint"), name: "Lint", warningOutput: "full" },
  { command: run("typecheck"), name: "TypeScript current" },
  { command: run("typecheck:minimum"), name: "TypeScript minimum" },
  { command: run("test:coverage"), name: "Tests and coverage" },
  { command: run("test:fuzz"), name: "Seeded property and fuzz tests" },
  { command: run("build:kern"), name: "Package build" },
  { command: run("size:check"), name: "Bundle budgets" },
  { command: run("benchmark:quick"), name: "Benchmark smoke" },
  { command: run("docs:check"), name: "Documentation" },
  { command: run("test:timezones"), name: "Timezone matrix" },
  { command: run("test:compat"), name: "Runtime compatibility" },
  { command: run("test:browser"), name: "Browser compatibility" },
  { command: run("test:frameworks"), name: "Framework tutorials" },
  { command: run("package:check"), name: "Packed package" },
  { command: run("audit"), name: "Dependency audit" },
]

await runWorkflow({ cwd: root, name: "release checks", steps })
