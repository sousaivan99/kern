import { describe, expect, test } from "bun:test"
import { printCapturedFailure, runCaptured } from "../scripts/shared/process.js"

describe("development subprocess capture", () => {
  test("captures output while streaming complete lines", async () => {
    const lines: string[] = []
    const result = await runCaptured(
      [
        process.execPath,
        "-e",
        'console.log("first"); console.error("second"); console.log("unterminated")',
      ],
      { onLine: (line) => lines.push(line) },
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("first")
    expect(result.stderr).toContain("second")
    expect(lines).toContain("first")
    expect(lines).toContain("second")
    expect(lines).toContain("unterminated")
  })

  test("retains failed command diagnostics for expansion", async () => {
    const result = await runCaptured([
      process.execPath,
      "-e",
      'console.log("context"); console.error("failure detail"); process.exit(7)',
    ])
    const messages: string[] = []
    const originalError = console.error
    console.error = (...values: unknown[]) => messages.push(values.join(" "))
    try {
      printCapturedFailure(result)
    } finally {
      console.error = originalError
    }

    expect(result.exitCode).toBe(7)
    expect(messages.join("\n")).toContain("Command failed")
    expect(messages.join("\n")).toContain("context")
    expect(messages.join("\n")).toContain("failure detail")
  })
})
