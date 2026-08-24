import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runWorkflow } from "../scripts/shared/workflow.js"

const withWorker = async <T>(
  callback: (root: string, worker: string) => Promise<T>,
): Promise<T> => {
  const root = await mkdtemp(join(tmpdir(), "kern-workflow-"))
  const worker = join(root, "worker.mjs")
  await writeFile(
    worker,
    [
      'import { appendFileSync } from "node:fs"',
      "const [log, id, delay, exitCode = '0'] = process.argv.slice(2)",
      'appendFileSync(log, "start " + id + "\\n")',
      "await Bun.sleep(Number(delay))",
      'appendFileSync(log, "end " + id + "\\n")',
      "process.exit(Number(exitCode))",
      "",
    ].join("\n"),
  )
  try {
    return await callback(root, worker)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

test("workflow runs ready steps concurrently and respects dependencies", async () => {
  await withWorker(async (root, worker) => {
    const log = join(root, "events.log")
    const command = (id: string, delay: number): readonly string[] => [
      process.execPath,
      worker,
      log,
      id,
      String(delay),
    ]
    await runWorkflow({
      cwd: root,
      maxConcurrency: 2,
      name: "test workflow",
      steps: [
        { command: command("a", 30), id: "a", name: "A" },
        { command: command("b", 0), dependsOn: ["a"], id: "b", name: "B" },
        { command: command("c", 30), id: "c", name: "C" },
      ],
    })

    const events = (await readFile(log, "utf8")).trim().split("\n")
    expect(events.indexOf("start b")).toBeGreaterThan(events.indexOf("end a"))
    let active = 0
    let maximum = 0
    for (const event of events) {
      active += event.startsWith("start") ? 1 : -1
      maximum = Math.max(maximum, active)
    }
    expect(maximum).toBe(2)
  })
})

test("workflow defaults to sequential execution", async () => {
  await withWorker(async (root, worker) => {
    const log = join(root, "events.log")
    await runWorkflow({
      cwd: root,
      name: "sequential workflow",
      steps: ["a", "b"].map((id) => ({
        command: [process.execPath, worker, log, id, "10"],
        id,
        name: id.toUpperCase(),
      })),
    })
    expect((await readFile(log, "utf8")).trim().split("\n")).toEqual([
      "start a",
      "end a",
      "start b",
      "end b",
    ])
  })
})

test("workflow terminates concurrent work after a failure", async () => {
  await withWorker(async (root, worker) => {
    const log = join(root, "events.log")
    const started = performance.now()
    await expect(
      runWorkflow({
        cwd: root,
        maxConcurrency: 2,
        name: "failing workflow",
        steps: [
          {
            command: [process.execPath, worker, log, "failure", "20", "7"],
            id: "failure",
            name: "Failure",
          },
          {
            command: [process.execPath, worker, log, "slow", "1000"],
            id: "slow",
            name: "Slow",
          },
          {
            command: [process.execPath, worker, log, "blocked", "0"],
            dependsOn: ["slow"],
            id: "blocked",
            name: "Blocked",
          },
        ],
      }),
    ).rejects.toThrow("failing workflow failed")
    expect(performance.now() - started).toBeLessThan(500)
    const events = await readFile(log, "utf8")
    expect(events).toContain("start slow")
    expect(events).not.toContain("end slow")
    expect(events).not.toContain("start blocked")
  })
})

test("workflow rejects invalid dependency graphs", async () => {
  await expect(
    runWorkflow({
      cwd: process.cwd(),
      name: "invalid workflow",
      steps: [{ command: [process.execPath, "--version"], dependsOn: ["missing"], name: "A" }],
    }),
  ).rejects.toThrow("Unknown dependency")

  await expect(
    runWorkflow({
      cwd: process.cwd(),
      name: "cyclic workflow",
      steps: [
        { command: [process.execPath, "--version"], dependsOn: ["b"], id: "a", name: "A" },
        { command: [process.execPath, "--version"], dependsOn: ["a"], id: "b", name: "B" },
      ],
    }),
  ).rejects.toThrow("dependency cycle")
})

test("workflow collects successful warnings in deterministic step-name order", async () => {
  const messages: string[] = []
  const originalWarn = console.warn
  console.warn = (...values: unknown[]) => messages.push(values.join(" "))
  try {
    await runWorkflow({
      cwd: process.cwd(),
      maxConcurrency: 2,
      name: "warning workflow",
      steps: [
        {
          command: [process.execPath, "-e", 'console.warn("Warning: second")'],
          id: "second",
          name: "Zulu",
        },
        {
          command: [process.execPath, "-e", 'console.warn("Warning: first")'],
          id: "first",
          name: "Alpha",
        },
      ],
    })
  } finally {
    console.warn = originalWarn
  }
  expect(messages.join("\n").indexOf("Warnings from Alpha")).toBeLessThan(
    messages.join("\n").indexOf("Warnings from Zulu"),
  )
})
