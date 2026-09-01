import { access, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { packageManifest } from "../shared/packages.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const seenDirectories = new Set<string>()
const versions = new Map<string, string>()

for (const definition of packageManifest.packages) {
  if (seenDirectories.has(definition.directory)) {
    throw new Error(`Duplicate package directory: ${definition.directory}`)
  }
  seenDirectories.add(definition.directory)
  const root = join(repositoryRoot, definition.directory)
  const metadata = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    readonly name?: string
    readonly peerDependencies?: Readonly<Record<string, string>>
    readonly version?: string
    readonly exports?: Readonly<Record<string, unknown>>
  }
  if (metadata.name !== definition.name) throw new Error(`${definition.id} has the wrong name`)
  if (!metadata.version || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(metadata.version)) {
    throw new Error(`${definition.name} must use a stable semantic version`)
  }
  versions.set(definition.id, metadata.version)
  if (
    JSON.stringify(metadata.peerDependencies ?? {}) !== JSON.stringify(definition.frameworkPeers)
  ) {
    throw new Error(`${definition.name} framework peers do not match the package manifest`)
  }
  const exports = Object.keys(metadata.exports ?? {}).sort()
  if (exports.join(",") !== ".,./package.json") {
    throw new Error(`${definition.name} must export only its root and package.json`)
  }
  for (const path of [
    "src/index.ts",
    "README.md",
    "CHANGELOG.md",
    "SEMVER.md",
    "SUPPORT.md",
    "LICENSE",
  ]) {
    await access(join(root, path)).catch(() => {
      throw new Error(`${definition.name} is missing ${path}`)
    })
  }
}

const formVersions = packageManifest.packages
  .filter(({ releaseGroup }) => releaseGroup === "form")
  .map(({ id }) => versions.get(id))
if (new Set(formVersions).size !== 1)
  throw new Error("Form release-group versions must be synchronized")
