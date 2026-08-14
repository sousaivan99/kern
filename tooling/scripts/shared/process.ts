export interface CapturedProcess {
  readonly command: readonly string[]
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

export interface CapturedProcessOptions {
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly onLine?: (line: string) => void
}

const capturedOutput = (result: CapturedProcess): string =>
  [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n")

const warningPattern =
  /(?:\[(?:WARN|warn)\]|\bWARN\b|\b(?:[A-Z][A-Za-z]*)?Warning\b|\b[1-9]\d*\s+warnings?\b|\bwarn(?:ing)?:)/u

const isWarningLine = (line: string): boolean => warningPattern.test(line)

const processOutputPrefixPattern = /^@\S+\s+\S+:\s*/u
const warningContinuationPattern = /^(?:\(!\)|[-*]\s|at\s)/u

const isWarningContinuation = (line: string): boolean => {
  let content = line
  while (processOutputPrefixPattern.test(content)) {
    content = content.replace(processOutputPrefixPattern, "")
  }
  return warningContinuationPattern.test(content.trimStart())
}

const capturedWarnings = (result: CapturedProcess): string => {
  const warnings: string[] = []
  let followsWarning = false

  for (const line of capturedOutput(result).split(/\r?\n/u)) {
    if (isWarningLine(line)) {
      warnings.push(line)
      followsWarning = true
    } else if (followsWarning && isWarningContinuation(line)) {
      warnings.push(line)
    } else {
      followsWarning = false
    }
  }

  return warnings.join("\n")
}

const consumeStream = async (
  stream: ReadableStream<Uint8Array>,
  onLine?: (line: string) => void,
): Promise<string> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ""
  let pending = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    output += text
    if (!onLine) continue
    pending += text
    const lines = pending.split(/\r?\n/u)
    pending = lines.pop() ?? ""
    for (const line of lines) onLine(line)
  }

  const finalText = decoder.decode()
  output += finalText
  pending += finalText
  if (onLine && pending.length > 0) onLine(pending)
  return output
}

export const runCaptured = async (
  command: readonly string[],
  options: CapturedProcessOptions = {},
): Promise<CapturedProcess> => {
  const child = Bun.spawn([...command], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: { ...options.env } }),
    stderr: "pipe",
    stdout: "pipe",
  })
  const stdout = consumeStream(child.stdout, options.onLine)
  const stderr = consumeStream(child.stderr, options.onLine)
  const [exitCode, capturedStdout, capturedStderr] = await Promise.all([
    child.exited,
    stdout,
    stderr,
  ])
  return { command, exitCode, stderr: capturedStderr, stdout: capturedStdout }
}

export const printCapturedFailure = (result: CapturedProcess): void => {
  const command = result.command.join(" ")
  console.error(`\nCommand failed: ${command}\n`)
  const output = capturedOutput(result)
  if (output) console.error(output)
}

export const hasCapturedWarnings = (result: CapturedProcess): boolean =>
  capturedWarnings(result).length > 0

export const printCapturedWarnings = (
  result: CapturedProcess,
  stepName: string,
  includeContext = false,
): void => {
  const warnings = capturedWarnings(result)
  if (!warnings) return
  console.warn(`\nWarnings from ${stepName}:\n`)
  console.warn(includeContext ? capturedOutput(result) : warnings)
}
