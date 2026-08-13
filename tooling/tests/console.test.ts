import { describe, expect, test } from "bun:test"
import { renderTable, stripAnsi, type TableColumn, terminal } from "../scripts/shared/console.js"

interface ExampleRow {
  readonly name: string
  readonly value: number
}

const columns: readonly TableColumn<ExampleRow>[] = [
  { header: "name", style: "cyan", value: (row) => row.name },
  { align: "right", header: "value", style: "green", value: (row) => row.value },
]

describe("development console", () => {
  test("renders aligned tables without requiring color support", () => {
    expect(renderTable([{ name: "array", value: 42 }], columns, { colors: false })).toBe(
      [
        "┌───────┬───────┐",
        "│ name  │ value │",
        "├───────┼───────┤",
        "│ array │    42 │",
        "└───────┴───────┘",
      ].join("\n"),
    )
  })

  test("keeps colored table alignment and content stable", () => {
    const plain = renderTable([{ name: "validation", value: 1_000 }], columns, { colors: false })
    const colored = renderTable([{ name: "validation", value: 1_000 }], columns, { colors: true })

    expect(colored).toContain("\u001B[")
    expect(stripAnsi(colored)).toBe(plain)
  })

  test("formats consistent status and detail messages", () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error
    console.log = (...values: unknown[]) => messages.push(values.join(" "))
    console.warn = (...values: unknown[]) => messages.push(values.join(" "))
    console.error = (...values: unknown[]) => messages.push(values.join(" "))

    try {
      terminal.heading("Benchmarks")
      terminal.detail("runtime", "Bun")
      terminal.info("Measuring")
      terminal.success("Passed")
      terminal.warning("Noisy result")
      terminal.error("Failed")
      terminal.table([{ name: "array", value: 42 }], columns)
    } finally {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
    }

    expect(messages).toHaveLength(7)
    expect(messages.join("\n")).toContain("Benchmarks")
    expect(messages.join("\n")).not.toContain("within budget")
  })
})
