import { describe, expect, test } from "bun:test"
import { join, resolve } from "node:path"

const repositoryRoot = resolve(import.meta.dir, "../..")
const reportPath = join(repositoryRoot, "apps", "docs", "src", "data", "package-sizes.json")

interface PackageMetadata {
  readonly version: string
}

interface SizeReport {
  readonly entrypoints: ReadonlyArray<{
    readonly budgetBytes: number
    readonly gzipBytes: number
    readonly id: string
    readonly rawBytes: number
  }>
  readonly examples: ReadonlyArray<{
    readonly fixture: string
    readonly gzipBytes: number
    readonly id: string
    readonly rawBytes: number
    readonly source: string
    readonly version: string
  }>
  readonly measurement: {
    readonly bunVersion: string
    readonly compression: string
    readonly format: string
    readonly minified: boolean
    readonly target: string
  }
  readonly rootEntrypoint: { readonly gzipBytes: number; readonly rawBytes: number }
  readonly schemaVersion: number
}

const readJson = async <T>(path: string): Promise<T> => Bun.file(path).json() as Promise<T>

describe("versioned package-size report", () => {
  test("records deterministic measurement metadata and positive sizes", async () => {
    const report = await readJson<SizeReport>(reportPath)

    expect(report.schemaVersion).toBe(1)
    expect(report.measurement).toEqual({
      bunVersion: "1.3.14",
      compression: "gzip, level 9",
      format: "esm",
      minified: true,
      target: "browser",
    })
    expect(report.entrypoints.map((entry) => entry.id)).toEqual([
      "validation",
      "money",
      "date",
      "number",
      "array",
      "string",
      "object",
      "async",
    ])
    for (const entry of report.entrypoints) {
      expect(entry.rawBytes).toBeGreaterThan(0)
      expect(entry.gzipBytes).toBeGreaterThan(0)
      expect(entry.gzipBytes).toBeLessThanOrEqual(entry.budgetBytes)
    }
    expect(report.rootEntrypoint.rawBytes).toBeGreaterThan(0)
    expect(report.rootEntrypoint.gzipBytes).toBeGreaterThan(0)
  })

  test("keeps package versions and displayed sources synchronized with fixtures", async () => {
    const report = await readJson<SizeReport>(reportPath)
    const versionPaths = {
      kern: join(repositoryRoot, "packages", "kern", "package.json"),
      valibot: join(repositoryRoot, "tooling", "node_modules", "valibot", "package.json"),
      zod: join(repositoryRoot, "tooling", "node_modules", "zod", "package.json"),
    } as const

    for (const example of report.examples) {
      const metadata = await readJson<PackageMetadata>(
        versionPaths[example.id as keyof typeof versionPaths],
      )
      const fixtureSource = await Bun.file(join(repositoryRoot, example.fixture)).text()
      expect(example.version).toBe(metadata.version)
      expect(example.source).toBe(fixtureSource)
      expect(example.rawBytes).toBeGreaterThan(0)
      expect(example.gzipBytes).toBeGreaterThan(0)
    }
  })
})
