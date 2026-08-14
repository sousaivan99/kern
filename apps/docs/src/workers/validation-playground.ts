import * as validation from "@sousaivan/kern/validation"
import typescript from "typescript"

interface RunRequest {
  readonly id: number
  readonly source: string
  readonly type: "run"
}

interface RunResponse {
  readonly id: number
  readonly output: string
  readonly state: "error" | "success"
}

type ConsoleWriter = (...values: readonly unknown[]) => void

const allowedModule = "@sousaivan/kern/validation"
const blockedBrowserApi = /\b(?:fetch|WebSocket|EventSource|XMLHttpRequest|importScripts)\b/

const normalizeForDisplay = (value: unknown, seen: WeakSet<object>): unknown => {
  if (typeof value === "bigint") return `${value}n`
  if (typeof value === "symbol") return String(value)
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`
  if (value === undefined) return "undefined"
  if (value === null || typeof value !== "object") return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (seen.has(value)) return "[Circular]"

  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => normalizeForDisplay(item, seen))

  const output: Record<string, unknown> = Object.create(null)
  for (const key of Object.keys(value))
    output[key] = normalizeForDisplay(Reflect.get(value, key), seen)
  return output
}

const formatValue = (value: unknown): string => {
  const normalized = normalizeForDisplay(value, new WeakSet())
  if (typeof normalized === "string") return normalized
  if (normalized === undefined) return "undefined"
  return JSON.stringify(normalized, null, 2)
}

const validateSource = (source: string): void => {
  if (/\bimport\s*\(/.test(source)) throw new TypeError("Dynamic imports are not available here.")
  if (blockedBrowserApi.test(source)) throw new TypeError("Network APIs are not available here.")

  const imports = source.matchAll(/\bimport\s+[\s\S]*?\sfrom\s*["']([^"']+)["']/g)
  for (const match of imports) {
    if (match[1] !== allowedModule) {
      throw new TypeError(`Only ${JSON.stringify(allowedModule)} can be imported.`)
    }
  }
}

const rewriteImports = (javascript: string): string => {
  const rewritten = javascript.replace(
    /\bimport\s*\{([\s\S]*?)\}\s*from\s*["']@sousaivan\/kern\/validation["'];?/g,
    (_match, rawNames: string) => {
      const names = rawNames
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => name.replace(/\s+as\s+/g, ": "))
        .join(", ")
      return `const { ${names} } = __kernValidation;`
    },
  )

  if (/\b(?:import|export)\s/.test(rewritten)) {
    throw new SyntaxError("Use a named import from @sousaivan/kern/validation.")
  }
  return rewritten
}

const transpile = (source: string): string => {
  validateSource(source)
  const result = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: "validation-playground.ts",
    reportDiagnostics: true,
  })
  const diagnostic = result.diagnostics?.find(
    (candidate) => candidate.category === typescript.DiagnosticCategory.Error,
  )
  if (diagnostic) {
    throw new SyntaxError(typescript.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
  }
  return rewriteImports(result.outputText)
}

const execute = async (request: RunRequest): Promise<RunResponse> => {
  const lines: string[] = []
  const write: ConsoleWriter = (...values) => lines.push(values.map(formatValue).join(" "))
  const capturedConsole: Pick<Console, "error" | "log" | "warn"> = {
    error: write,
    log: write,
    warn: write,
  }

  try {
    const javascript = transpile(request.source)
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
      ...parameters: readonly string[]
    ) => (...arguments_: readonly unknown[]) => Promise<void>
    const run = new AsyncFunction("__kernValidation", "console", `"use strict";\n${javascript}`)
    await run(validation, capturedConsole)
    return {
      id: request.id,
      output: lines.length > 0 ? lines.join("\n") : "Finished without console output.",
      state: "success",
    }
  } catch (error) {
    return {
      id: request.id,
      output: error instanceof Error ? `${error.name}: ${error.message}` : formatValue(error),
      state: "error",
    }
  }
}

self.addEventListener("message", (event: MessageEvent<RunRequest>) => {
  if (event.data.type !== "run") return
  void execute(event.data).then((response) => self.postMessage(response))
})
