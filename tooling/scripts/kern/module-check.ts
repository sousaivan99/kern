import { access, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { moduleManifest } from "../shared/modules.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const packageRoot = join(repositoryRoot, "packages", "kern")
const docsRoot = join(repositoryRoot, "apps", "docs", "src", "content", "docs")
const built = process.argv.includes("--built")
const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as {
  readonly exports?: Readonly<Record<string, unknown>>
}
const rootSource = await readFile(join(packageRoot, "src", "index.ts"), "utf8")

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const expectedExports = new Set([
  ".",
  "./package.json",
  ...moduleManifest.modules.map((module) => `./${module.id}`),
])
const actualExports = new Set(Object.keys(packageJson.exports ?? {}))
for (const entrypoint of expectedExports) {
  if (!actualExports.has(entrypoint)) throw new Error(`Package exports are missing ${entrypoint}`)
}
for (const entrypoint of actualExports) {
  if (!expectedExports.has(entrypoint)) throw new Error(`Module manifest is missing ${entrypoint}`)
}

for (const module of moduleManifest.modules) {
  const source = join(packageRoot, "src", module.id, "index.ts")
  if (!(await exists(source))) throw new Error(`Missing source entrypoint for ${module.id}`)
  if (!rootSource.includes(`./${module.id}/index.js`)) {
    throw new Error(`Root entrypoint does not re-export ${module.id}`)
  }

  const docsCandidates = [
    join(docsRoot, `${module.docsRoute}.md`),
    join(docsRoot, `${module.docsRoute}.mdx`),
    join(docsRoot, module.docsRoute, "index.md"),
    join(docsRoot, module.docsRoute, "index.mdx"),
  ]
  if (!(await Promise.all(docsCandidates.map(exists))).some(Boolean)) {
    throw new Error(`Missing documentation route for ${module.id}: ${module.docsRoute}`)
  }

  if (built && !(await exists(join(packageRoot, "dist", module.id, "index.d.ts")))) {
    throw new Error(`Built declarations are missing for ${module.id}`)
  }
}

if (built && !(await exists(join(packageRoot, "dist", "index.d.ts")))) {
  throw new Error("Built root declarations are missing")
}
