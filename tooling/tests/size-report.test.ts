import { describe, expect, test } from "bun:test"
import { join, resolve } from "node:path"
import packageManifest from "../config/packages.json"

const repositoryRoot = resolve(import.meta.dir, "../..")
const reportPath = join(repositoryRoot, "apps", "docs", "src", "data", "package-sizes.json")

interface Measurement {
  readonly budgetBytes: number
  readonly gzipBytes: number
  readonly id: string
  readonly import?: string
  readonly rawBytes: number
}

interface SizeReport {
  readonly fixtures: ReadonlyArray<
    Measurement & { readonly fixture: string; readonly label: string }
  >
  readonly measurement: {
    readonly bunVersion: string
    readonly compression: string
    readonly format: string
    readonly minified: boolean
    readonly target: string
  }
  readonly packages: readonly Measurement[]
  readonly schemaVersion: number
}

describe("versioned package-size report", () => {
  test("records every manifest package and realistic fixture within its budget", async () => {
    const report = (await Bun.file(reportPath).json()) as SizeReport
    expect(report.schemaVersion).toBe(2)
    expect(report.measurement).toEqual({
      bunVersion: Bun.version,
      compression: "gzip, level 9",
      format: "esm",
      minified: true,
      target: "browser",
    })
    expect(report.packages.map(({ id }) => id)).toEqual(
      packageManifest.packages.map(({ id }) => id),
    )
    for (const entry of [...report.packages, ...report.fixtures]) {
      expect(entry.rawBytes).toBeGreaterThan(0)
      expect(entry.gzipBytes).toBeGreaterThan(0)
      expect(entry.gzipBytes).toBeLessThanOrEqual(entry.budgetBytes)
    }
    expect(report.fixtures.map(({ id }) => id)).toEqual(["form-validation"])
    for (const fixture of report.fixtures) {
      expect(await Bun.file(join(repositoryRoot, fixture.fixture)).exists()).toBe(true)
    }
  })
})
