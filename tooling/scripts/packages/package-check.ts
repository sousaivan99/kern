import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { terminal } from "../shared/console.js"
import { type PackageDefinition, packageById, packageManifest } from "../shared/packages.js"
import { selectedPackageId } from "./arguments.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const selected = selectedPackageId()
const requested = selected ? [packageById(selected)] : packageManifest.packages
const definitions = requested.some(
  (definition) => definition.id === "form-vue" || definition.id === "form-react",
)
  ? [
      ...new Map(
        [packageById("form"), ...requested].map((definition) => [definition.id, definition]),
      ).values(),
    ]
  : requested
const temporaryRoot = await mkdtemp(join(tmpdir(), "lithekit-packages-"))
const reuseBuild = process.argv.includes("--reuse-build")
const outputArgument = process.argv.find((argument) => argument.startsWith("--tarball-output="))
const outputDirectory = outputArgument?.slice("--tarball-output=".length)

const run = (command: readonly string[], cwd: string): void => {
  const result = Bun.spawnSync([...command], { cwd, stderr: "inherit", stdout: "inherit" })
  if (result.exitCode !== 0) throw new Error(`Command failed: ${command.join(" ")}`)
}

const pack = async (definition: PackageDefinition): Promise<string> => {
  const destination = join(temporaryRoot, "tarballs", definition.id)
  await mkdir(destination, { recursive: true })
  run(
    [process.execPath, "pm", "pack", "--destination", destination, "--ignore-scripts"],
    join(repositoryRoot, definition.directory),
  )
  const tarballName = (await readdir(destination)).find((name) => name.endsWith(".tgz"))
  if (!tarballName) throw new Error(`No tarball produced for ${definition.name}`)
  const tarball = join(destination, tarballName)
  if (outputDirectory) {
    await mkdir(resolve(outputDirectory), { recursive: true })
    await copyFile(tarball, join(resolve(outputDirectory), tarballName))
  }
  return tarball
}

try {
  if (!reuseBuild) {
    for (const definition of definitions) {
      run(
        [process.execPath, "tooling/scripts/packages/build.ts", `--package=${definition.id}`],
        repositoryRoot,
      )
    }
  }
  for (const definition of requested) {
    run(
      [
        "node",
        join(
          repositoryRoot,
          "tooling",
          "node_modules",
          "@arethetypeswrong",
          "cli",
          "dist",
          "index.js",
        ),
        "--pack",
        ".",
        "--profile",
        "esm-only",
        "--quiet",
      ],
      join(repositoryRoot, definition.directory),
    )
  }
  const tarballs = new Map<string, string>()
  for (const definition of definitions) tarballs.set(definition.id, await pack(definition))

  for (const definition of requested) {
    const consumer = join(temporaryRoot, "consumers", definition.id)
    await mkdir(consumer, { recursive: true })
    const dependencies: Record<string, string> = {
      [definition.name]: `file:${tarballs.get(definition.id) as string}`,
    }
    const overrides: Record<string, string> = {}
    if (definition.id === "form-vue" || definition.id === "form-react") {
      const formTarball = `file:${tarballs.get("form") as string}`
      dependencies["@lithekit/form"] = formTarball
      overrides["@lithekit/form"] = formTarball
    }
    if (definition.id === "form-vue") dependencies.vue = "3.3.13"
    if (definition.id === "form-react") {
      dependencies.react = "18.3.1"
      dependencies["@types/react"] = "^18"
    }
    await writeFile(
      join(consumer, "package.json"),
      `${JSON.stringify({ private: true, type: "module", dependencies, ...(Object.keys(overrides).length > 0 ? { overrides } : {}) }, null, 2)}\n`,
    )
    run([process.execPath, "install"], consumer)

    const installedRoot = join(consumer, "node_modules", "@lithekit", definition.id)
    run([process.execPath, "x", "publint", "--strict", installedRoot], repositoryRoot)
    for (const policy of ["CHANGELOG.md", "SEMVER.md", "SUPPORT.md", "LICENSE"]) {
      if (!(await Bun.file(join(installedRoot, policy)).exists())) {
        throw new Error(`${definition.name} tarball is missing ${policy}`)
      }
    }
    const smoke = join(consumer, "smoke.mjs")
    await writeFile(
      smoke,
      `const module = await import(${JSON.stringify(definition.name)}); if (Object.keys(module).length === 0) throw new Error("No exports");\n`,
    )
    run(["node", smoke], consumer)
    run([process.execPath, smoke], consumer)
    await writeFile(
      join(consumer, "types.ts"),
      `import * as packageApi from ${JSON.stringify(definition.name)}; void packageApi;\n`,
    )
    await writeFile(
      join(consumer, "tsconfig.json"),
      `${JSON.stringify({ compilerOptions: { lib: ["ES2022", "DOM"], module: "ESNext", moduleResolution: "Bundler", noEmit: true, skipLibCheck: false, strict: true, target: "ES2022" }, files: ["types.ts"] }, null, 2)}\n`,
    )
    run(
      [
        "node",
        join(repositoryRoot, "tooling", "node_modules", "typescript", "bin", "tsc"),
        "--project",
        "tsconfig.json",
      ],
      consumer,
    )
    run(
      [
        "node",
        join(repositoryRoot, "tooling", "node_modules", "typescript-5", "bin", "tsc"),
        "--project",
        "tsconfig.json",
      ],
      consumer,
    )

    if (definition.id === "form-vue") {
      if (await Bun.file(join(consumer, "node_modules", "react", "package.json")).exists()) {
        throw new Error("Vue-only Form installation resolved React")
      }
      if (
        await Bun.file(
          join(consumer, "node_modules", "@lithekit", "form-react", "package.json"),
        ).exists()
      ) {
        throw new Error("Vue-only Form installation resolved @lithekit/form-react")
      }
    }
    if (definition.id === "form-react") {
      if (await Bun.file(join(consumer, "node_modules", "vue", "package.json")).exists()) {
        throw new Error("React-only Form installation resolved Vue")
      }
      if (
        await Bun.file(
          join(consumer, "node_modules", "@lithekit", "form-vue", "package.json"),
        ).exists()
      ) {
        throw new Error("React-only Form installation resolved @lithekit/form-vue")
      }
    }
    terminal.success(`${definition.name} packed installation passed`)
  }
} finally {
  await rm(temporaryRoot, { force: true, recursive: true })
}
