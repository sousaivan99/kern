import { progress } from "@clack/prompts"
import { printCapturedFailure, runCaptured } from "./process.js"

export interface WorkflowStep {
  readonly command: readonly string[]
  readonly name: string
}

export interface WorkflowOptions {
  readonly cwd: string
  readonly name: string
  readonly steps: readonly WorkflowStep[]
}

export const runWorkflow = async ({ cwd, name, steps }: WorkflowOptions): Promise<void> => {
  const started = performance.now()
  const bar = progress({ max: steps.length, size: 32, style: "block" })
  bar.start(`0/${steps.length} · Preparing ${name}`)

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index] as WorkflowStep
    bar.message(`${index}/${steps.length} · ${step.name}`)
    const result = await runCaptured(step.command, { cwd })
    if (result.exitCode !== 0) {
      bar.error(`${step.name} failed`)
      printCapturedFailure(result)
      process.exit(result.exitCode)
    }
    bar.advance(1, `${index + 1}/${steps.length} · ${step.name}`)
  }

  const elapsedSeconds = ((performance.now() - started) / 1_000).toFixed(1)
  bar.stop(`${steps.length} ${name} passed · ${elapsedSeconds}s`)
}
