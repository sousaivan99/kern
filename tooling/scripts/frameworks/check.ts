import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { once } from "node:events"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join, resolve, sep } from "node:path"
import { chromium } from "playwright"
import { terminal } from "../shared/console.js"
import { printCapturedFailure, runCaptured } from "../shared/process.js"

interface TutorialFile {
  readonly code: string
  readonly path: string
}

const repositoryRoot = resolve(import.meta.dir, "../../..")
const packageRoot = join(repositoryRoot, "packages", "kern")
const docsRoot = join(repositoryRoot, "apps", "docs", "src", "content", "docs", "frameworks")
const docsModules = join(repositoryRoot, "apps", "docs", "node_modules")
const toolingModules = join(repositoryRoot, "tooling", "node_modules")
const temporaryRoot = await mkdtemp(join(tmpdir(), "kern-frameworks-"))

const tutorialPages = ["javascript-typescript.md", "vue.md", "nuxt.md", "react.md"] as const
const marker =
  /<!-- framework-test: ([a-z]+\/[a-zA-Z0-9._/-]+) -->\r?\n```[^\r\n]*\r?\n([\s\S]*?)\r?\n```/gu

const run = async (name: string, command: readonly string[], cwd: string): Promise<string> => {
  terminal.info(name)
  const result = await runCaptured(command, { cwd })
  if (result.exitCode !== 0) {
    terminal.error(`${name} failed`)
    printCapturedFailure(result)
    throw new Error(`${name} exited with code ${result.exitCode}`)
  }
  terminal.success(name)
  return result.stdout
}

const readTutorialFiles = async (): Promise<readonly TutorialFile[]> => {
  const files: TutorialFile[] = []
  for (const page of tutorialPages) {
    const source = await readFile(join(docsRoot, page), "utf8")
    for (const match of source.matchAll(marker)) {
      const path = match[1]
      const code = match[2]
      if (path === undefined || code === undefined) continue
      files.push({ code: `${code}\n`, path })
    }
  }

  const expected = [
    "nuxt/app/app.vue",
    "nuxt/server/api/contact.post.ts",
    "react/src/App.tsx",
    "vanilla/javascript.mjs",
    "vanilla/typescript.ts",
    "vue/src/App.vue",
  ]
  const actual = files.map((file) => file.path).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Framework tutorial files changed. Expected ${expected.join(", ")}; got ${actual.join(", ")}`,
    )
  }
  return files
}

const write = async (root: string, path: string, contents: string): Promise<void> => {
  const destination = resolve(root, path)
  if (!destination.startsWith(`${resolve(root)}${sep}`)) {
    throw new Error(`Refusing to write tutorial path outside its fixture: ${path}`)
  }
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, contents)
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`
const installedDependency = async (name: string, modules = toolingModules): Promise<string> => {
  const manifest = JSON.parse(
    await readFile(join(modules, ...name.split("/"), "package.json"), "utf8"),
  ) as { readonly version?: unknown }
  if (typeof manifest.version !== "string") {
    throw new Error(`Could not read the installed version of ${name}`)
  }
  return `${name}@${manifest.version}`
}

const reservePort = async (): Promise<number> => {
  const reservation = createServer()
  reservation.listen(0, "127.0.0.1")
  await once(reservation, "listening")
  const address = reservation.address()
  if (typeof address === "string" || address === null) {
    reservation.close()
    throw new Error("Could not reserve a frontend test port")
  }
  const port = address.port
  reservation.close()
  await once(reservation, "close")
  return port
}

const exerciseFrontend = async (name: string, fixture: string): Promise<void> => {
  terminal.info(`Exercise ${name} in Chromium`)
  const port = await reservePort()
  const preview = Bun.spawn(
    [
      "node",
      join(fixture, "node_modules", "vite", "bin", "vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { cwd: fixture, stderr: "pipe", stdout: "ignore" },
  )
  const stderr = new Response(preview.stderr).text()
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()
    const browserErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text())
    })
    page.on("pageerror", (error) => browserErrors.push(error.message))

    let loaded = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const response = await page.goto(`http://127.0.0.1:${port}`)
        loaded = response?.ok() === true
        if (loaded) break
      } catch {
        await Bun.sleep(50)
      }
    }
    if (!loaded) throw new Error(`${name} preview did not become ready`)

    const status = page.locator('p[aria-live="polite"]')
    await status.waitFor()
    if ((await status.textContent()) !== "Ready: ada@example.com") {
      throw new Error(`${name} did not render its initial validation result`)
    }
    const total = page.getByText("Total: €129.99", { exact: true })
    if ((await total.count()) !== 1) throw new Error(`${name} did not render the formatted total`)

    await page.locator('input[name="email"]').fill("not-an-email")
    await page.getByText("Invalid email address", { exact: true }).waitFor()
    await page.locator('input[name="email"]').fill("grace@example.com")
    await page.getByText("Ready: grace@example.com", { exact: true }).waitFor()
    await page.waitForTimeout(50)

    if (browserErrors.length > 0) {
      throw new Error(`${name} reported browser errors:\n${browserErrors.join("\n")}`)
    }
  } catch (error) {
    preview.kill()
    await preview.exited
    const previewError = (await stderr).trim()
    if (previewError.length > 0) console.error(previewError)
    throw error
  } finally {
    await browser.close()
    preview.kill()
    await preview.exited
  }
  terminal.success(`Exercise ${name} in Chromium`)
}

const strictCompilerOptions = {
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  isolatedModules: true,
  lib: ["ESNext", "DOM", "DOM.Iterable"],
  module: "ESNext",
  moduleResolution: "Bundler",
  noUncheckedIndexedAccess: true,
  skipLibCheck: false,
  strict: true,
  target: "ES2022",
  useDefineForClassFields: true,
} as const

const configureVanilla = async (root: string): Promise<void> => {
  await write(
    root,
    "tsconfig.json",
    json({ compilerOptions: strictCompilerOptions, files: ["typescript.ts"] }),
  )
}

const configureVue = async (root: string): Promise<void> => {
  await write(
    root,
    "index.html",
    '<div id="app"></div><script type="module" src="/src/main.ts"></script>\n',
  )
  await write(
    root,
    "src/main.ts",
    'import { createApp } from "vue"\nimport App from "./App.vue"\n\ncreateApp(App).mount("#app")\n',
  )
  await write(
    root,
    "src/server.ts",
    'import { createSSRApp } from "vue"\nimport { renderToString } from "vue/server-renderer"\nimport App from "./App.vue"\n\nconst html = await renderToString(createSSRApp(App))\nif (!html.includes("Ready: ada@example.com") || !html.includes("€129.99")) {\n  throw new Error("Unexpected Vue SSR output: " + html)\n}\n',
  )
  await write(
    root,
    "vite.config.ts",
    'import vue from "@vitejs/plugin-vue"\nimport { defineConfig } from "vite"\n\nexport default defineConfig({ plugins: [vue()] })\n',
  )
  await write(
    root,
    "tsconfig.json",
    json({
      compilerOptions: { ...strictCompilerOptions, types: ["node", "vite/client"] },
      include: ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"],
    }),
  )
}

const configureReact = async (root: string): Promise<void> => {
  await write(
    root,
    "index.html",
    '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n',
  )
  await write(
    root,
    "src/main.tsx",
    'import { StrictMode } from "react"\nimport { createRoot } from "react-dom/client"\nimport { App } from "./App"\n\ncreateRoot(document.querySelector("#root")!).render(<StrictMode><App /></StrictMode>)\n',
  )
  await write(
    root,
    "src/server.tsx",
    'import { renderToString } from "react-dom/server"\nimport { App } from "./App"\n\nconst html = renderToString(<App />)\nif (!html.includes("Ready: ada@example.com") || !html.includes("€129.99")) {\n  throw new Error("Unexpected React SSR output: " + html)\n}\n',
  )
  await write(
    root,
    "vite.config.ts",
    'import react from "@vitejs/plugin-react"\nimport { defineConfig } from "vite"\n\nexport default defineConfig({ plugins: [react()] })\n',
  )
  await write(
    root,
    "tsconfig.json",
    json({
      compilerOptions: {
        ...strictCompilerOptions,
        jsx: "react-jsx",
        types: ["node", "vite/client"],
      },
      include: ["src", "vite.config.ts"],
    }),
  )
}

const configureNuxt = async (root: string): Promise<void> => {
  await write(
    root,
    "tsconfig.json",
    json({
      files: [],
      references: [
        { path: "./.nuxt/tsconfig.app.json" },
        { path: "./.nuxt/tsconfig.server.json" },
        { path: "./.nuxt/tsconfig.shared.json" },
        { path: "./.nuxt/tsconfig.node.json" },
      ],
    }),
  )
  await write(
    root,
    "nuxt.config.ts",
    'export default defineNuxtConfig({ compatibilityDate: "2026-08-13", devtools: { enabled: false } })\n',
  )
  await write(
    root,
    "verify.mjs",
    `import { createServer } from "node:net"
import { once } from "node:events"
import { spawn } from "node:child_process"

const reservation = createServer()
reservation.listen(0, "127.0.0.1")
await once(reservation, "listening")
const address = reservation.address()
if (typeof address === "string" || address === null) throw new Error("Could not reserve a port")
const port = address.port
reservation.close()
await once(reservation, "close")

const child = spawn(process.execPath, [".output/server/index.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, HOST: "127.0.0.1", NODE_ENV: "production", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
})
let output = ""
child.stdout.on("data", (chunk) => { output += chunk })
child.stderr.on("data", (chunk) => { output += chunk })
const origin = \`http://127.0.0.1:\${port}\`

const request = async (path, init) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(\`Nuxt server exited early.\n\${output}\`)
    try {
      return await fetch(\`\${origin}\${path}\`, init)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  throw new Error(\`Nuxt server did not become ready.\n\${output}\`)
}

try {
  const page = await request("/")
  const html = await page.text()
  if (!page.ok || !html.includes("Nuxt checkout") || !html.includes("€129.99")) {
    throw new Error(\`Unexpected Nuxt SSR response (\${page.status}): \${html}\`)
  }

  const valid = await request("/api/contact", {
    body: JSON.stringify({ name: " Ada Lovelace ", email: "ada@example.com", ignored: true }),
    headers: { "content-type": "application/json" },
    method: "POST",
  })
  const contact = await valid.json()
  if (!valid.ok || contact.name !== "Ada Lovelace" || contact.ignored !== undefined) {
    throw new Error(\`Unexpected valid API response (\${valid.status}): \${JSON.stringify(contact)}\`)
  }

  const invalid = await request("/api/contact", {
    body: JSON.stringify({ name: "A", email: "not-an-email" }),
    headers: { "content-type": "application/json" },
    method: "POST",
  })
  const problem = await invalid.json()
  if (invalid.status !== 400 || !Array.isArray(problem.data?.issues)) {
    throw new Error(\`Unexpected invalid API response (\${invalid.status}): \${JSON.stringify(problem)}\`)
  }
} finally {
  if (child.exitCode === null) child.kill("SIGTERM")
  if (child.exitCode === null) await once(child, "exit")
}
`,
  )
}

try {
  await run("Build Kern", [process.execPath, "run", "build"], packageRoot)
  await run(
    "Pack Kern",
    [process.execPath, "pm", "pack", "--destination", temporaryRoot, "--ignore-scripts"],
    packageRoot,
  )
  const tarballName = (await readdir(temporaryRoot)).find((name) => name.endsWith(".tgz"))
  if (tarballName === undefined) throw new Error("Framework checks could not find the Kern tarball")
  const tarball = join(temporaryRoot, tarballName)

  const tutorialFiles = await readTutorialFiles()
  const fixtures = ["vanilla", "vue", "react", "nuxt"] as const
  for (const fixtureName of fixtures) {
    const fixture = join(temporaryRoot, fixtureName)
    await mkdir(fixture, { recursive: true })
    await write(
      fixture,
      "package.json",
      json({ name: `kern-${fixtureName}-tutorial`, private: true, type: "module" }),
    )
    for (const file of tutorialFiles.filter(({ path }) => path.startsWith(`${fixtureName}/`))) {
      await write(fixture, file.path.slice(fixtureName.length + 1), file.code)
    }
    await run(
      `Install packed Kern for ${fixtureName}`,
      [process.execPath, "add", tarball, "--exact", "--ignore-scripts"],
      fixture,
    )
  }

  const vanilla = join(temporaryRoot, "vanilla")
  const vue = join(temporaryRoot, "vue")
  const react = join(temporaryRoot, "react")
  const nuxt = join(temporaryRoot, "nuxt")

  const installDevelopmentDependencies = async (
    name: string,
    fixture: string,
    dependencies: readonly string[],
  ): Promise<void> => {
    await run(
      `Install ${name} test toolchain`,
      [process.execPath, "add", "--dev", "--exact", "--ignore-scripts", ...dependencies],
      fixture,
    )
  }
  const frameworkTypeScript = await installedDependency("typescript", docsModules)
  await installDevelopmentDependencies("vanilla", vanilla, [frameworkTypeScript])
  await installDevelopmentDependencies(
    "Vue",
    vue,
    await Promise.all([
      installedDependency("@types/node"),
      installedDependency("@vitejs/plugin-vue"),
      frameworkTypeScript,
      installedDependency("vite"),
      installedDependency("vue"),
      installedDependency("vue-tsc"),
    ]),
  )
  await installDevelopmentDependencies(
    "React",
    react,
    await Promise.all([
      installedDependency("@types/node"),
      installedDependency("@types/react"),
      installedDependency("@types/react-dom"),
      installedDependency("@vitejs/plugin-react"),
      installedDependency("react"),
      installedDependency("react-dom"),
      frameworkTypeScript,
      installedDependency("vite"),
    ]),
  )
  await installDevelopmentDependencies(
    "Nuxt",
    nuxt,
    await Promise.all([
      installedDependency("@types/node"),
      installedDependency("nuxt"),
      frameworkTypeScript,
      installedDependency("vue-tsc"),
    ]),
  )

  await configureVanilla(vanilla)
  await configureVue(vue)
  await configureReact(react)
  await configureNuxt(nuxt)

  const node = "node"
  const binary = (fixture: string, ...path: readonly string[]): string =>
    join(fixture, "node_modules", ...path)

  await run("Run JavaScript tutorial", [node, "javascript.mjs"], vanilla)
  await run(
    "Type-check TypeScript tutorial",
    [node, binary(vanilla, "typescript", "bin", "tsc"), "--noEmit"],
    vanilla,
  )
  await run(
    "Bundle JavaScript and TypeScript tutorials",
    [
      process.execPath,
      "build",
      "javascript.mjs",
      "typescript.ts",
      "--outdir",
      "dist",
      "--target",
      "browser",
    ],
    vanilla,
  )
  await run(
    "Type-check Vue tutorial",
    [node, binary(vue, "vue-tsc", "bin", "vue-tsc.js"), "--noEmit"],
    vue,
  )
  await run("Build Vue client", [node, binary(vue, "vite", "bin", "vite.js"), "build"], vue)
  await run(
    "Build Vue SSR",
    [
      node,
      binary(vue, "vite", "bin", "vite.js"),
      "build",
      "--ssr",
      "src/server.ts",
      "--outDir",
      "dist-ssr",
    ],
    vue,
  )
  await run("Render Vue SSR", [node, "dist-ssr/server.js"], vue)
  await exerciseFrontend("Vue", vue)
  await run(
    "Type-check React tutorial",
    [node, binary(react, "typescript", "bin", "tsc"), "--noEmit"],
    react,
  )
  await run("Build React client", [node, binary(react, "vite", "bin", "vite.js"), "build"], react)
  await run(
    "Build React SSR",
    [
      node,
      binary(react, "vite", "bin", "vite.js"),
      "build",
      "--ssr",
      "src/server.tsx",
      "--outDir",
      "dist-ssr",
    ],
    react,
  )
  await run("Render React SSR", [node, "dist-ssr/server.js"], react)
  await exerciseFrontend("React", react)
  const nuxtCli = binary(nuxt, "nuxt", "bin", "nuxt.mjs")
  await run("Type-check Nuxt tutorial", [node, nuxtCli, "typecheck"], nuxt)
  await run("Build Nuxt server", [node, nuxtCli, "build"], nuxt)
  await run("Exercise Nuxt SSR and API", [node, "verify.mjs"], nuxt)

  terminal.success("All framework tutorials passed with the packed Kern package")
} finally {
  await rm(temporaryRoot, { force: true, recursive: true })
}
