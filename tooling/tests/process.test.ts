import { describe, expect, test } from "bun:test"
import {
  type CapturedProcess,
  hasCapturedWarnings,
  printCapturedFailure,
  printCapturedWarnings,
  runCaptured,
} from "../scripts/shared/process.js"

const capturedResult = (stdout: string, stderr = ""): CapturedProcess => ({
  command: ["example"],
  exitCode: 0,
  stderr,
  stdout,
})

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

  test("detects common warning labels in either captured stream", () => {
    expect(hasCapturedWarnings(capturedResult("Found 2 warnings."))).toBe(true)
    expect(hasCapturedWarnings(capturedResult("", "WARN deprecated option"))).toBe(true)
    expect(hasCapturedWarnings(capturedResult("DeprecationWarning: deprecated option"))).toBe(true)
    expect(hasCapturedWarnings(capturedResult("Checked 98 files. No fixes applied."))).toBe(false)
    expect(hasCapturedWarnings(capturedResult("Result: 0 warnings"))).toBe(false)
    expect(hasCapturedWarnings(capturedResult("No warnings found"))).toBe(false)
    expect(hasCapturedWarnings(capturedResult("test name mentions warning labels"))).toBe(false)
  })

  test("prints successful warning diagnostics with their workflow step", () => {
    const messages: string[] = []
    const originalWarn = console.warn
    console.warn = (...values: unknown[]) => messages.push(values.join(" "))
    try {
      printCapturedWarnings(
        capturedResult(
          [
            "routine output",
            "@kern/docs build: [WARN] plugin diagnostic",
            "@kern/docs build: (!) Generated chunk is large. Consider:",
            "@sousaivan/kern test:browser: @kern/docs build: - splitting the entrypoint",
            "more routine output",
          ].join("\n"),
        ),
        "Lint",
      )
      printCapturedWarnings(capturedResult("No diagnostics found"), "TypeScript")
    } finally {
      console.warn = originalWarn
    }

    expect(messages).toHaveLength(2)
    expect(messages.join("\n")).toContain("Warnings from Lint")
    expect(messages.join("\n")).toContain("plugin diagnostic")
    expect(messages.join("\n")).toContain("Generated chunk is large")
    expect(messages.join("\n")).toContain("splitting the entrypoint")
    expect(messages.join("\n")).not.toContain("routine output")
    expect(messages.join("\n")).not.toContain("TypeScript")
  })

  test("can retain full diagnostic context for warning-oriented commands", () => {
    const messages: string[] = []
    const originalWarn = console.warn
    console.warn = (...values: unknown[]) => messages.push(values.join(" "))
    try {
      printCapturedWarnings(capturedResult("diagnostic context\nFound 1 warning."), "Lint", true)
    } finally {
      console.warn = originalWarn
    }

    expect(messages.join("\n")).toContain("diagnostic context")
    expect(messages.join("\n")).toContain("Found 1 warning")
  })
})
