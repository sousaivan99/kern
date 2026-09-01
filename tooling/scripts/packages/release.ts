import { resolve } from "node:path"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const publish = process.argv.includes("--publish")
const bootstrap = process.argv.includes("--all")
for (const argument of process.argv.slice(2)) {
  if (argument !== "--publish" && argument !== "--all")
    throw new Error(`Unknown release option: ${argument}`)
}

const run = (arguments_: readonly string[], capture = false, cwd = repositoryRoot): string => {
  const result = Bun.spawnSync([...arguments_], {
    cwd,
    stderr: capture ? "pipe" : "inherit",
    stdout: capture ? "pipe" : "inherit",
  })
  if (result.exitCode !== 0) throw new Error(`Command failed: ${arguments_.join(" ")}`)
  return capture ? new TextDecoder().decode(result.stdout).trim() : ""
}

const contract = run(
  [
    process.execPath,
    "tooling/scripts/packages/release-contract.ts",
    "--json",
    ...(bootstrap ? ["--all"] : []),
    ...(publish ? ["--check-npm"] : []),
  ],
  true,
)
const releases = JSON.parse(contract) as Array<{
  id: string
  name: string
  tag: string
  version: string
}>
if (releases.length === 0) process.exit(0)

run([process.execPath, "run", "packages:check"])
run([process.execPath, "run", "build:packages"])
for (const release of releases) {
  run([
    process.execPath,
    "tooling/scripts/packages/package-check.ts",
    `--package=${release.id}`,
    "--reuse-build",
  ])
  if (publish) {
    run(
      ["npm", "publish", "--access", "public", "--provenance", "--ignore-scripts"],
      false,
      `${repositoryRoot}/packages/${release.id}`,
    )
  } else {
    run(
      [process.execPath, "pm", "pack", "--dry-run", "--ignore-scripts"],
      false,
      `${repositoryRoot}/packages/${release.id}`,
    )
  }
}

if (publish) {
  const tags = new Map<string, { names: string[]; version: string }>()
  for (const release of releases) {
    const entry = tags.get(release.tag) ?? { names: [], version: release.version }
    entry.names.push(release.name)
    tags.set(release.tag, entry)
  }
  for (const [tag, release] of tags) {
    run(["git", "tag", "-a", tag, "-m", `${release.names.join(", ")} ${release.version}`])
    run(["git", "push", "origin", tag])
    run([
      "gh",
      "release",
      "create",
      tag,
      "--title",
      `${release.names.join(", ")} ${release.version}`,
      "--generate-notes",
    ])
  }
}
