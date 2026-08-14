import { progress } from "@clack/prompts"
import {
  type CapturedProcess,
  hasCapturedWarnings,
  printCapturedFailure,
  printCapturedWarnings,
  runCaptured,
} from "./process.js"

export interface WorkflowStep {
  readonly command: readonly string[]
  readonly name: string
  readonly warningOutput?: "full" | "matching-lines"
}

export interface WorkflowOptions {
  readonly cwd: string
  readonly name: string
  readonly steps: readonly WorkflowStep[]
}

interface WorkflowWarning {
  readonly includeContext: boolean
  readonly result: CapturedProcess
  readonly stepName: string
}

const printWarnings = (warnings: readonly WorkflowWarning[]): void => {
  for (const warning of warnings) {
    printCapturedWarnings(warning.result, warning.stepName, warning.includeContext)
  }
}

export const runWorkflow = async ({ cwd, name, steps }: WorkflowOptions): Promise<void> => {
  const started = performance.now()
  const bar = progress({ max: steps.length, size: 32, style: "block" })
  const warnings: WorkflowWarning[] = []
  bar.start(`0/${steps.length} · Preparing ${name}`)

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index] as WorkflowStep
    bar.message(`${index}/${steps.length} · ${step.name}`)
    const result = await runCaptured(step.command, { cwd })
    if (result.exitCode !== 0) {
      bar.error(`${step.name} failed`)
      printWarnings(warnings)
      printCapturedFailure(result)
      process.exit(result.exitCode)
    }
    if (hasCapturedWarnings(result)) {
      warnings.push({
        includeContext: step.warningOutput === "full",
        result,
        stepName: step.name,
      })
    }
    bar.advance(1, `${index + 1}/${steps.length} · ${step.name}`)
  }

  const elapsedSeconds = ((performance.now() - started) / 1_000).toFixed(1)
  const warningSummary = warnings.length === 0 ? "" : " with warnings"
  bar.stop(`${steps.length} ${name} passed${warningSummary} · ${elapsedSeconds}s`)
  printWarnings(warnings)
}
