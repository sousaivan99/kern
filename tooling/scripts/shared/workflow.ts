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
  readonly dependsOn?: readonly string[]
  readonly id?: string
  readonly name: string
  readonly warningOutput?: "full" | "matching-lines"
}

export interface WorkflowOptions {
  readonly cwd: string
  readonly maxConcurrency?: number
  readonly name: string
  readonly steps: readonly WorkflowStep[]
}

interface WorkflowWarning {
  readonly includeContext: boolean
  readonly result: CapturedProcess
  readonly stepName: string
}

interface IndexedStep {
  readonly dependencies: readonly string[]
  readonly id: string
  readonly index: number
  readonly step: WorkflowStep
}

const printWarnings = (warnings: readonly WorkflowWarning[]): void => {
  for (const warning of warnings) {
    printCapturedWarnings(warning.result, warning.stepName, warning.includeContext)
  }
}

const indexedSteps = (steps: readonly WorkflowStep[]): readonly IndexedStep[] => {
  const indexed = steps.map((step, index) => ({
    dependencies: step.dependsOn ?? [],
    id: step.id ?? `step-${index}`,
    index,
    step,
  }))
  const ids = new Set<string>()
  for (const item of indexed) {
    if (ids.has(item.id)) throw new Error(`Duplicate workflow step id: ${item.id}`)
    ids.add(item.id)
  }
  for (const item of indexed) {
    for (const dependency of item.dependencies) {
      if (!ids.has(dependency)) {
        throw new Error(`Unknown dependency ${dependency} for workflow step ${item.id}`)
      }
      if (dependency === item.id) {
        throw new Error(`Workflow step ${item.id} cannot depend on itself`)
      }
    }
  }
  return indexed
}

export const runWorkflow = async ({
  cwd,
  maxConcurrency = 1,
  name,
  steps,
}: WorkflowOptions): Promise<void> => {
  if (!Number.isSafeInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new RangeError("Workflow concurrency must be a positive safe integer")
  }

  const items = indexedSteps(steps)
  const started = performance.now()
  const bar = progress({ max: items.length, size: 32, style: "block" })
  const warnings: WorkflowWarning[] = []
  const completed = new Set<string>()
  const pending = new Map(items.map((item) => [item.id, item]))
  const running = new Map<string, Promise<void>>()
  const results = new Map<string, CapturedProcess>()
  const controller = new AbortController()
  let completedCount = 0
  let failed = false

  const activeNames = (): string =>
    [...running.keys()]
      .map((id) => items.find((item) => item.id === id)?.step.name)
      .filter((value): value is string => value !== undefined)
      .join(", ")

  const update = (): void => {
    const active = activeNames()
    bar.message(`${completedCount}/${items.length}${active ? ` · ${active}` : " · Preparing"}`)
  }

  const launch = (item: IndexedStep): void => {
    pending.delete(item.id)
    const task = runCaptured(item.step.command, { cwd, signal: controller.signal })
      .then((result) => {
        results.set(item.id, result)
        completedCount += 1
        bar.advance(1)
        if (result.exitCode !== 0 && !result.aborted) {
          failed = true
          controller.abort()
        } else if (result.exitCode === 0) {
          completed.add(item.id)
          if (hasCapturedWarnings(result)) {
            warnings.push({
              includeContext: item.step.warningOutput === "full",
              result,
              stepName: item.step.name,
            })
          }
        }
      })
      .finally(() => {
        running.delete(item.id)
        update()
      })
    running.set(item.id, task)
  }

  bar.start(`0/${items.length} · Preparing ${name}`)
  while (pending.size > 0 || running.size > 0) {
    if (!failed) {
      for (const item of items) {
        if (running.size >= maxConcurrency) break
        if (!pending.has(item.id)) continue
        if (item.dependencies.every((dependency) => completed.has(dependency))) launch(item)
      }
    }
    update()

    if (running.size === 0) {
      if (failed) break
      const blocked = [...pending.values()].map((item) => item.id).join(", ")
      bar.error(`Workflow dependency cycle: ${blocked}`)
      throw new Error(`Workflow steps are blocked by a dependency cycle: ${blocked}`)
    }
    await Promise.race(running.values())
  }

  await Promise.allSettled(running.values())
  if (failed) {
    bar.error(`${name} failed`)
    printWarnings(warnings.sort((left, right) => left.stepName.localeCompare(right.stepName)))
    for (const item of items) {
      const result = results.get(item.id)
      if (result && result.exitCode !== 0 && !result.aborted) printCapturedFailure(result)
    }
    throw new Error(`${name} failed`)
  }

  const elapsedSeconds = ((performance.now() - started) / 1_000).toFixed(1)
  const warningSummary = warnings.length === 0 ? "" : " with warnings"
  bar.stop(`${items.length} ${name} passed${warningSummary} · ${elapsedSeconds}s`)
  printWarnings(warnings.sort((left, right) => left.stepName.localeCompare(right.stepName)))
}
