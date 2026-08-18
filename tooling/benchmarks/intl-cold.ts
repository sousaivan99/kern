import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpus } from "node:os"
import { resolve } from "node:path"

const quick = process.argv.includes("--quick")
const json = process.argv.includes("--json")
const sampleCount = quick ? 5 : 21
const cases = ["number", "date", "money-format", "money-parse"] as const
const repositoryRoot = resolve(import.meta.dir, "../..")
const worker = resolve(import.meta.dir, "intl-cold-worker.ts")

const git = (arguments_: readonly string[]): string => {
  const result = spawnSync("git", arguments_, { cwd: repositoryRoot, encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr || "Unable to fingerprint repository")
  return result.stdout
}

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex")

const percentile = (samples: readonly number[], fraction: number): number =>
  samples[Math.max(0, Math.ceil(samples.length * fraction) - 1)] ?? 0

const results = cases.map((name) => {
  const samples = Array.from({ length: sampleCount }, () => {
    const result = spawnSync(process.execPath, [worker, name], {
      cwd: repositoryRoot,
      encoding: "utf8",
    })
    if (result.status !== 0) throw new Error(result.stderr || `Cold ${name} worker failed`)
    const value = Number(result.stdout)
    if (!Number.isFinite(value)) throw new Error(`Cold ${name} worker returned invalid timing`)
    return value
  }).sort((left, right) => left - right)
  return {
    id: `intl-cold:${name}`,
    medianNanoseconds: percentile(samples, 0.5),
    p95Nanoseconds: percentile(samples, 0.95),
    samplesNanoseconds: samples,
  }
})

const report = {
  metadata: {
    architecture: process.arch,
    cpu: cpus()[0]?.model ?? "unknown",
    gitHead: git(["rev-parse", "HEAD"]).trim(),
    gitStatus: git(["status", "--porcelain=v2"]),
    mode: quick ? "quick" : "full",
    platform: process.platform,
    runtime: `Bun ${Bun.version}`,
    sampleCount,
    timestamp: new Date().toISOString(),
    trackedDiffHash: sha256(git(["diff", "--binary", "HEAD"])),
  },
  results,
}

if (json) console.log(JSON.stringify(report, null, 2))
else {
  console.log("Cold Intl import + first-call benchmark (isolated processes)")
  for (const result of results) {
    console.log(
      `${result.id}\tmedian ${(result.medianNanoseconds / 1_000_000).toFixed(2)} ms\tp95 ${(result.p95Nanoseconds / 1_000_000).toFixed(2)} ms`,
    )
  }
}
