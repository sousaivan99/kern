import { appendFile, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { type PackageDefinition, packageManifest } from "../shared/packages.js"
import { compareVersions } from "../shared/release.js"

export interface PlannedRelease {
  readonly id: string
  readonly name: string
  readonly tag: string
  readonly version: string
}

const repositoryRoot = resolve(import.meta.dir, "../../..")
const arguments_ = new Set(process.argv.slice(2))
const checkNpm = arguments_.has("--check-npm")
const githubOutput = arguments_.has("--github-output")
const bootstrap = arguments_.has("--all")
for (const argument of arguments_) {
  if (!["--all", "--check-npm", "--github-output", "--json"].includes(argument)) {
    throw new Error(`Unknown release-contract option: ${argument}`)
  }
}

const command = (
  commandArguments: readonly string[],
  allowFailure = false,
): { code: number; output: string } => {
  const result = Bun.spawnSync([...commandArguments], {
    cwd: repositoryRoot,
    stderr: "pipe",
    stdout: "pipe",
  })
  if (!allowFailure && result.exitCode !== 0) {
    throw new Error(
      new TextDecoder().decode(result.stderr) || `Command failed: ${commandArguments.join(" ")}`,
    )
  }
  return { code: result.exitCode, output: new TextDecoder().decode(result.stdout).trim() }
}

const versionAndChangelog = async (
  definition: PackageDefinition,
): Promise<{ changelog: string; version: string }> => {
  const root = join(repositoryRoot, definition.directory)
  const metadata = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    version?: unknown
  }
  if (typeof metadata.version !== "string") throw new Error(`${definition.name} has no version`)
  return {
    changelog: await readFile(join(root, "CHANGELOG.md"), "utf8"),
    version: metadata.version,
  }
}

const tagPrefix = (definition: PackageDefinition): string =>
  definition.releaseGroup === "form" ? "form-v" : `${definition.id}-v`

const latestTag = (definition: PackageDefinition): string | undefined => {
  const output = command([
    "git",
    "tag",
    "--list",
    `${tagPrefix(definition)}*`,
    "--sort=-version:refname",
  ]).output
  return output.split("\n").find(Boolean)
}

const changed = (definition: PackageDefinition, tag: string | undefined): boolean => {
  if (bootstrap || !tag) return true
  const paths = [
    definition.directory,
    "tsconfig.base.json",
    "tsconfig.package.json",
    "tooling/config/packages.json",
    "tooling/scripts/packages/build.ts",
  ]
  const result = command(["git", "diff", "--quiet", tag, "HEAD", "--", ...paths], true)
  if (result.code !== 0 && result.code !== 1)
    throw new Error(`Unable to compare ${definition.name} release inputs`)
  return result.code === 1
}

const rawChanged = new Set(
  packageManifest.packages
    .filter((definition) => changed(definition, latestTag(definition)))
    .map(({ id }) => id),
)
const changedGroups = new Set(
  packageManifest.packages
    .filter(({ id }) => rawChanged.has(id))
    .map(({ releaseGroup }) => releaseGroup),
)
const affected = packageManifest.packages
  .filter(({ releaseGroup }) => changedGroups.has(releaseGroup))
  .sort((left, right) => left.publishOrder - right.publishOrder || left.id.localeCompare(right.id))

const releases: PlannedRelease[] = []
for (const definition of affected) {
  const { changelog, version } = await versionAndChangelog(definition)
  const latest = latestTag(definition)
  const latestVersion = latest ? latest.slice(tagPrefix(definition).length) : "0.0.0"
  if (compareVersions(version, latestVersion) <= 0) {
    throw new Error(`${definition.name} version ${version} must be newer than ${latestVersion}`)
  }
  if (!changelog.includes(`## ${version}`) && !changelog.includes(`## [${version}]`)) {
    throw new Error(`${definition.name} changelog is missing a ${version} release section`)
  }
  if (checkNpm) {
    const result = command(
      ["npm", "view", `${definition.name}@${version}`, "version", "--json"],
      true,
    )
    if (result.code === 0) throw new Error(`${definition.name}@${version} already exists on npm`)
  }
  releases.push({
    id: definition.id,
    name: definition.name,
    tag: `${tagPrefix(definition)}${version}`,
    version,
  })
}

for (const group of changedGroups) {
  const versions = new Set(
    releases
      .filter(
        ({ id }) => packageManifest.packages.find((item) => item.id === id)?.releaseGroup === group,
      )
      .map(({ version }) => version),
  )
  if (versions.size !== 1)
    throw new Error(`Release group ${group} must use one synchronized version`)
}

const serialized = JSON.stringify(releases)
if (githubOutput) {
  const output = process.env.GITHUB_OUTPUT
  if (!output) throw new Error("GITHUB_OUTPUT is required with --github-output")
  await appendFile(
    output,
    `releases=${serialized}\nrelease_required=${String(releases.length > 0)}\n`,
  )
} else {
  console.log(
    arguments_.has("--json")
      ? serialized
      : releases.length > 0
        ? `Ready: ${releases.map(({ name, version }) => `${name}@${version}`).join(", ")}`
        : "No release required",
  )
}
