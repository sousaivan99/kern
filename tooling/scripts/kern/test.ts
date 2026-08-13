import { readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import { progress } from "@clack/prompts"
import { stripAnsi, terminal } from "../shared/console.js"
import { printCapturedFailure, runCaptured } from "../shared/process.js"

const root = join(resolve(import.meta.dir, "../../.."), "packages", "kern")
const testFiles = [...new Bun.Glob("tests/**/*.test.ts").scanSync({ cwd: root })].sort()
const arguments_ = process.argv.slice(2)
const fileFilters = arguments_
  .filter((argument) => argument.endsWith(".test.ts"))
  .map((argument) => argument.replace(/^\.\//u, ""))
const selectedTestFiles =
  fileFilters.length === 0
    ? testFiles
    : testFiles.filter((file) => fileFilters.some((filter) => file.includes(filter)))

const countTestsInFile = async (file: string): Promise<number> => {
  const source = await readFile(join(root, file), "utf8")
  return [...source.matchAll(/\b(?:it|test)(?:\.only)?\s*\(/gu)].length
}

const totalTests = (
  await Promise.all(selectedTestFiles.map((file) => countTestsInFile(file)))
).reduce((total, count) => total + count, 0)
const coverage = arguments_.includes("--coverage")
let completed = 0
let currentFile = "discovering tests"
const maximumLabelLength = Math.max(20, (process.stdout.columns ?? 100) - 42)
const compactLabel = (value: string): string =>
  value.length <= maximumLabelLength ? value : `${value.slice(0, maximumLabelLength - 1)}…`
const message = (label: string): string =>
  `${Math.min(completed, totalTests)}/${totalTests} · ${compactLabel(label)}`
const bar = progress({ max: Math.max(1, totalTests), size: 24, style: "block" })

bar.start(message(currentFile))
const result = await runCaptured([process.execPath, "test", ...arguments_], {
  cwd: root,
  onLine(line) {
    const plainLine = stripAnsi(line).trim()
    const fileMatch = /^(tests\/[^:]+\.test\.ts):$/u.exec(plainLine)
    if (fileMatch?.[1]) {
      currentFile = relative("tests", fileMatch[1])
      bar.message(message(currentFile))
      return
    }
    const testMatch = /^\((?:pass|fail)\)\s+(.+?)(?:\s+\[[^\]]+\])?$/u.exec(plainLine)
    if (!testMatch?.[1]) return
    completed += 1
    bar.advance(1, message(testMatch[1]))
  },
})

if (result.exitCode !== 0) {
  bar.error(`Tests failed after ${completed}/${totalTests}`)
  printCapturedFailure(result)
  process.exit(result.exitCode)
}

const combinedOutput = `${result.stdout}\n${result.stderr}`
const passed = Number(/(?:^|\n)\s*(\d+) pass(?:\n|$)/u.exec(combinedOutput)?.[1] ?? completed)
const elapsed = /Ran \d+ tests? across \d+ files?\. \[([^\]]+)\]/u.exec(combinedOutput)?.[1]
bar.stop(`${passed} tests passed${elapsed ? ` · ${elapsed}` : ""}`)

if (coverage) {
  const coverageMatch = /All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/u.exec(combinedOutput)
  if (coverageMatch) {
    terminal.detail("coverage", `${coverageMatch[1]}% functions · ${coverageMatch[2]}% lines`)
  }
}
