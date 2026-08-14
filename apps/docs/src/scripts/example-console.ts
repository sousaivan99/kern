type ConsoleWriter = (...values: readonly unknown[]) => void

const supportedModules = [
  "@sousaivan/kern",
  "@sousaivan/kern/array",
  "@sousaivan/kern/async",
  "@sousaivan/kern/date",
  "@sousaivan/kern/money",
  "@sousaivan/kern/number",
  "@sousaivan/kern/object",
  "@sousaivan/kern/string",
  "@sousaivan/kern/validation",
] as const

type SupportedModule = (typeof supportedModules)[number]

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
  for (const key of Object.keys(value)) {
    output[key] = normalizeForDisplay(Reflect.get(value, key), seen)
  }
  return output
}

const formatNormalizedValue = (value: unknown, nested = false): string => {
  if (typeof value === "string") return nested ? JSON.stringify(value) : value
  if (value === null || typeof value !== "object") return String(value)

  if (Array.isArray(value)) {
    return `[${value.map((item) => formatNormalizedValue(item, true)).join(", ")}]`
  }

  const entries = Object.entries(value)
  if (entries.length === 0) return "{}"
  return `{ ${entries
    .map(([key, item]) => `${JSON.stringify(key)}: ${formatNormalizedValue(item, true)}`)
    .join(", ")} }`
}

const formatConsoleValue = (value: unknown): string =>
  formatNormalizedValue(normalizeForDisplay(value, new WeakSet()))

const formatConsoleLine = (values: readonly unknown[]) => values.map(formatConsoleValue).join(" ")

const formatThrownError = (error: unknown): string => {
  const summary = formatConsoleValue(error)
  if (!(error instanceof Error) || !("issues" in error) || !Array.isArray(error.issues)) {
    return summary
  }
  return `${summary}\nIssues: ${formatConsoleValue(error.issues)}`
}

const loadKernModule = async (specifier: string): Promise<Record<string, unknown>> => {
  switch (specifier as SupportedModule) {
    case "@sousaivan/kern":
      return import("@sousaivan/kern")
    case "@sousaivan/kern/array":
      return import("@sousaivan/kern/array")
    case "@sousaivan/kern/async":
      return import("@sousaivan/kern/async")
    case "@sousaivan/kern/date":
      return import("@sousaivan/kern/date")
    case "@sousaivan/kern/money":
      return import("@sousaivan/kern/money")
    case "@sousaivan/kern/number":
      return import("@sousaivan/kern/number")
    case "@sousaivan/kern/object":
      return import("@sousaivan/kern/object")
    case "@sousaivan/kern/string":
      return import("@sousaivan/kern/string")
    case "@sousaivan/kern/validation":
      return import("@sousaivan/kern/validation")
    default:
      throw new TypeError(`The interactive console cannot load ${JSON.stringify(specifier)}.`)
  }
}

const readCodeSource = (figure: HTMLElement): string => {
  const copyButton = figure.querySelector<HTMLButtonElement>("button[data-code]")
  const copiedSource = copyButton?.dataset.code
  if (copiedSource) return copiedSource.replaceAll("\u007f", "\n")

  return figure.querySelector("pre code")?.textContent ?? ""
}

const containsConsoleLog = (source: string): boolean => source.includes("console.log")

const unsupportedImport = (source: string): string | undefined => {
  const imports = source.matchAll(/\b(?:import|export)\s+[\s\S]*?\sfrom\s*["']([^"']+)["']/g)
  for (const match of imports) {
    const specifier = match[1]
    if (specifier && !supportedModules.includes(specifier as SupportedModule)) return specifier
  }
  return undefined
}

const exampleCannotRunReason = (
  source: string,
  language: string | undefined,
): string | undefined => {
  if (language === "tsx" || language === "jsx" || language === "vue") {
    return "This example needs its complete framework application, so it cannot run on this page."
  }

  const externalModule = unsupportedImport(source)
  if (externalModule) {
    return `This example needs ${externalModule} and must run inside the complete application.`
  }
  if (/\bfetch\s*\(/.test(source)) {
    return "This example makes a real network request, so the documentation does not run it for you."
  }
  return undefined
}

const rewriteImports = (javascript: string): string => {
  const rewritten = javascript.replace(
    /\bimport\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];?/g,
    (_match, rawNames: string, specifier: string) => {
      const names = rawNames
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => name.replace(/\s+as\s+/g, ": "))
        .join(", ")
      return `const { ${names} } = await __kernImport(${JSON.stringify(specifier)});`
    },
  )

  if (/\b(?:import|export)\s/.test(rewritten)) {
    throw new SyntaxError(
      "This example uses a module form that the interactive console cannot run.",
    )
  }
  return rewritten
}

const transpileExample = async (source: string): Promise<string> => {
  const typescript = await import("typescript")
  const result = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: "kern-documentation-example.ts",
    reportDiagnostics: true,
  })

  const error = result.diagnostics?.find(
    (diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error,
  )
  if (error) {
    throw new SyntaxError(typescript.flattenDiagnosticMessageText(error.messageText, "\n"))
  }

  return rewriteImports(result.outputText)
}

const findExampleHeading = (figure: HTMLElement): string => {
  const headings = document.querySelectorAll<HTMLElement>("main h1, main h2, main h3, main h4")
  let closestHeading: HTMLElement | undefined
  for (const heading of headings) {
    if (heading.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING) {
      closestHeading = heading
      continue
    }
    break
  }
  return closestHeading?.textContent?.trim() || "code example"
}

type InlineConsole = {
  readonly container: HTMLElement
  readonly button: HTMLButtonElement
  readonly output: HTMLOutputElement
}

let consoleIndex = 0

const createInlineConsole = (figure: HTMLElement, cannotRun: string | undefined): InlineConsole => {
  consoleIndex += 1

  const container = document.createElement("section")
  container.className = "kern-example-console not-content"
  container.dataset.state = cannotRun ? "unavailable" : "idle"

  const header = document.createElement("div")
  header.className = "kern-example-console__header"

  const label = document.createElement("span")
  label.className = "kern-example-console__label"
  label.textContent = "Console output"

  const button = document.createElement("button")
  button.className = "kern-example-console__run"
  button.type = "button"
  button.textContent = cannotRun ? "Needs app" : "Run example"
  button.disabled = cannotRun !== undefined

  const output = document.createElement("output")
  output.id = `kern-example-output-${consoleIndex}`
  output.className = "kern-example-console__output"
  output.setAttribute("aria-live", "polite")
  output.setAttribute("aria-atomic", "true")
  output.textContent = cannotRun ?? "Select “Run example” to see exactly what console.log() prints."

  button.setAttribute("aria-controls", output.id)
  button.setAttribute("aria-label", `Run example: ${findExampleHeading(figure)}`)
  header.append(label, button)
  container.append(header, output)

  const exampleBlock = figure.closest(".expressive-code")
  if (exampleBlock) exampleBlock.append(container)
  else figure.insertAdjacentElement("afterend", container)

  return { container, button, output }
}

const runCodeExample = async (source: string, console: InlineConsole): Promise<void> => {
  const lines: string[] = []
  console.button.disabled = true
  console.button.textContent = "Running…"
  console.container.dataset.state = "running"
  console.output.textContent = "Preparing the example…"

  const write: ConsoleWriter = (...values) => {
    lines.push(formatConsoleLine(values))
    console.output.textContent = lines.join("\n")
    console.output.scrollTop = console.output.scrollHeight
  }
  const capturedConsole: Pick<Console, "error" | "log" | "warn"> = {
    error: write,
    log: write,
    warn: write,
  }

  try {
    const javascript = await transpileExample(source)
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
      ...parameters: readonly string[]
    ) => (...arguments_: readonly unknown[]) => Promise<void>
    const execute = new AsyncFunction("__kernImport", "console", `"use strict";\n${javascript}`)
    await execute(loadKernModule, capturedConsole)

    console.container.dataset.state = "success"
    console.output.textContent =
      lines.length > 0 ? lines.join("\n") : "The example finished without printing anything."
  } catch (error) {
    console.container.dataset.state = "error"
    const thrownError = `Thrown error:\n${formatThrownError(error)}`
    console.output.textContent =
      lines.length > 0 ? `${lines.join("\n")}\n\n${thrownError}` : thrownError
  } finally {
    console.button.disabled = false
    console.button.textContent = "Run again"
  }
}

for (const figure of document.querySelectorAll<HTMLElement>(
  "main figure.frame:has(pre[data-language='ts'], pre[data-language='typescript'], pre[data-language='js'], pre[data-language='javascript'], pre[data-language='tsx'], pre[data-language='jsx'], pre[data-language='vue'])",
)) {
  const source = readCodeSource(figure)
  if (!containsConsoleLog(source)) continue

  const language = figure.querySelector("pre")?.dataset.language
  const cannotRun = exampleCannotRunReason(source, language)
  const inlineConsole = createInlineConsole(figure, cannotRun)
  if (!cannotRun) {
    inlineConsole.button.addEventListener("click", () => {
      void runCodeExample(source, inlineConsole)
    })
  }
}
