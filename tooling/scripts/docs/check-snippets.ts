import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { terminal } from "../shared/console.js"
import { printCapturedFailure, runCaptured } from "../shared/process.js"

interface Snippet {
  readonly code: string
  readonly line: number
  readonly source: string
}

const repositoryRoot = resolve(import.meta.dir, "../../..")
const contentRoot = join(repositoryRoot, "apps", "docs", "src", "content", "docs")
const packageConfig = join(repositoryRoot, "packages", "kern", "tsconfig.json")
const temporaryDirectory = await mkdtemp(join(tmpdir(), "kern-doc-snippets-"))

const extractSnippets = (source: string, file: string): Snippet[] => {
  const lines = source.split(/\r?\n/u)
  const snippets: Snippet[] = []
  let openingLine = -1
  let code: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string
    if (openingLine === -1) {
      if (/^```(?:ts|typescript)(?:\s.*)?$/u.test(line) && !/\bframework-only\b/u.test(line)) {
        openingLine = index + 2
        code = []
      }
      continue
    }
    if (line === "```") {
      snippets.push({ code: code.join("\n"), line: openingLine, source: file })
      openingLine = -1
      code = []
      continue
    }
    code.push(line)
  }

  if (openingLine !== -1)
    throw new Error(`${file}:${openingLine - 1} has an unclosed TypeScript fence`)
  return snippets
}

try {
  const files = [...new Bun.Glob("**/*.{md,mdx}").scanSync({ cwd: contentRoot, onlyFiles: true })]
    .filter((file) => !file.startsWith("reference/"))
    .sort()
  const snippets: Snippet[] = []

  for (const file of files) {
    const absolutePath = join(contentRoot, file)
    snippets.push(...extractSnippets(await readFile(absolutePath, "utf8"), file))
  }

  const generatedFiles: string[] = []
  for (let index = 0; index < snippets.length; index += 1) {
    const snippet = snippets[index] as Snippet
    const safeSource = snippet.source.replace(/[^a-zA-Z0-9]+/gu, "-").replace(/^-|-$/gu, "")
    const file = join(
      temporaryDirectory,
      `${String(index + 1).padStart(3, "0")}-${safeSource}-line-${snippet.line}.ts`,
    )
    await writeFile(file, `// ${snippet.source}:${snippet.line}\n${snippet.code}\n\nexport {}\n`)
    generatedFiles.push(file)
  }

  const config = join(temporaryDirectory, "tsconfig.json")
  await writeFile(
    config,
    `${JSON.stringify(
      {
        extends: packageConfig,
        compilerOptions: {
          noEmit: true,
          typeRoots: [join(repositoryRoot, "packages", "kern", "node_modules", "@types")],
        },
        files: generatedFiles,
      },
      null,
      2,
    )}\n`,
  )

  const compilers = [
    { label: "current TypeScript", command: [process.execPath, "x", "tsc", "--project", config] },
    {
      label: "TypeScript 5.0",
      command: [
        "node",
        join(repositoryRoot, "packages", "kern", "node_modules", "typescript-5", "bin", "tsc"),
        "--project",
        config,
      ],
    },
  ] as const

  for (const compiler of compilers) {
    const result = await runCaptured(compiler.command, { cwd: repositoryRoot })
    if (result.exitCode !== 0) {
      terminal.error(`Documentation snippets failed with ${compiler.label}`)
      printCapturedFailure(result)
      process.exit(result.exitCode)
    }
  }

  terminal.success(
    `${snippets.length} TypeScript snippets across ${files.length} pages compile with TypeScript 5.0 and current`,
  )
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true })
}
