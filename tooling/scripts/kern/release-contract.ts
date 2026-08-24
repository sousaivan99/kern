import { appendFile, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { validateReleaseContract } from "../shared/release.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const packageRoot = join(repositoryRoot, "packages", "kern")
const arguments_ = new Set(process.argv.slice(2))
const githubOutput = arguments_.has("--github-output")
const checkNpm = arguments_.has("--check-npm")
for (const argument of arguments_) {
  if (argument !== "--github-output" && argument !== "--check-npm") {
    throw new Error(`Unknown release-contract option: ${argument}`)
  }
}

const command = (arguments_: readonly string[]): string => {
  const result = Bun.spawnSync([...arguments_], {
    cwd: repositoryRoot,
    stderr: "pipe",
    stdout: "pipe",
  })
  if (result.exitCode !== 0) {
    throw new Error(
      new TextDecoder().decode(result.stderr) || `Command failed: ${arguments_.join(" ")}`,
    )
  }
  return new TextDecoder().decode(result.stdout).trim()
}

const latestTag = command([
  "git",
  "tag",
  "--list",
  "v[0-9]*.[0-9]*.[0-9]*",
  "--sort=-version:refname",
]).split("\n")[0]
if (!latestTag) throw new Error("No stable release tag exists")
const latestVersion = latestTag.slice(1)
const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as {
  readonly name: string
  readonly version: string
}
const changelog = await readFile(join(packageRoot, "CHANGELOG.md"), "utf8")
const publishablePaths = [
  "packages/kern/src",
  "packages/kern/package.json",
  "packages/kern/README.md",
  "packages/kern/CHANGELOG.md",
  "packages/kern/SEMVER.md",
  "packages/kern/SUPPORT.md",
  "packages/kern/LICENSE",
  "packages/kern/tsconfig.json",
  "packages/kern/tsconfig.build.json",
  "tooling/config/modules.json",
  "tooling/scripts/kern/build.ts",
]
const diff = Bun.spawnSync(
  ["git", "diff", "--quiet", latestTag, "HEAD", "--", ...publishablePaths],
  {
    cwd: repositoryRoot,
  },
)
if (diff.exitCode !== 0 && diff.exitCode !== 1) throw new Error("Unable to compare release inputs")
const result = validateReleaseContract({
  changelog,
  latestVersion,
  packageChanged: diff.exitCode === 1,
  version: manifest.version,
})

if (result.releaseRequired && checkNpm) {
  const published = Bun.spawnSync(
    ["npm", "view", `${manifest.name}@${manifest.version}`, "version", "--json"],
    {
      cwd: repositoryRoot,
      stderr: "ignore",
      stdout: "ignore",
    },
  )
  if (published.exitCode === 0)
    throw new Error(`${manifest.name}@${manifest.version} already exists on npm`)
}

if (githubOutput) {
  const output = process.env.GITHUB_OUTPUT
  if (!output) throw new Error("GITHUB_OUTPUT is required with --github-output")
  await appendFile(output, `release_required=${String(result.releaseRequired)}\n`)
} else {
  console.log(
    result.releaseRequired ? `Release ${manifest.version} is ready` : "No release required",
  )
}
