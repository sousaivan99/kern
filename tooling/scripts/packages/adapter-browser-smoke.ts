import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium, firefox, webkit } from "playwright"
import { terminal } from "../shared/console.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const fixtureRoot = join(repositoryRoot, "tooling/fixtures/form-adapters")
const temporaryRoot = await mkdtemp(join(tmpdir(), "lithekit-form-adapters-"))
const browserName =
  process.argv.find((argument) => argument.startsWith("--browser="))?.slice(10) ?? "chromium"
const browserType = { chromium, firefox, webkit }[browserName as "chromium" | "firefox" | "webkit"]
if (!browserType) throw new Error(`Unsupported browser engine: ${browserName}`)

try {
  const build = await Bun.build({
    entrypoints: [join(fixtureRoot, "react.tsx"), join(fixtureRoot, "vue.ts")],
    format: "esm",
    minify: false,
    outdir: temporaryRoot,
    target: "browser",
  })
  if (!build.success) throw new Error(`Adapter fixtures failed to build: ${build.logs.join("\n")}`)
  const serverBuild = await Bun.build({
    entrypoints: [join(fixtureRoot, "react-server.tsx"), join(fixtureRoot, "vue-server.ts")],
    format: "esm",
    minify: false,
    outdir: join(temporaryRoot, "server"),
    target: "bun",
  })
  if (!serverBuild.success) {
    throw new Error(`Adapter SSR fixtures failed to build: ${serverBuild.logs.join("\n")}`)
  }
  const reactServer = (await import(
    pathToFileURL(join(temporaryRoot, "server", "react-server.js")).href
  )) as { readonly render: () => string }
  const vueServer = (await import(
    pathToFileURL(join(temporaryRoot, "server", "vue-server.js")).href
  )) as { readonly render: () => Promise<string> }
  const serverMarkup = {
    react: reactServer.render(),
    vue: await vueServer.render(),
  }

  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname
      if (path === "/react.js" || path === "/vue.js") {
        return new Response(Bun.file(join(temporaryRoot, path.slice(1))), {
          headers: { "content-type": "text/javascript" },
        })
      }
      const adapter = path === "/vue" ? "vue" : "react"
      return new Response(
        `<!doctype html><html><body><div id="root">${serverMarkup[adapter]}</div><script type="module" src="/${adapter}.js"></script></body></html>`,
        { headers: { "content-type": "text/html" } },
      )
    },
  })
  const browser = await browserType.launch({ headless: true })
  try {
    const origin = `http://127.0.0.1:${server.port}`
    const reactPage = await browser.newPage()
    const reactErrors: string[] = []
    reactPage.on("pageerror", (error) => reactErrors.push(error.message))
    reactPage.on("console", (message) => {
      if (message.type() === "error") reactErrors.push(message.text())
    })
    await reactPage.goto(`${origin}/react`)
    const reactInput = reactPage.locator('input[name="email"]')
    await reactInput.waitFor({ timeout: 5_000 }).catch(() => {
      throw new Error(`React fixture did not mount:\n${reactErrors.join("\n")}`)
    })
    await reactPage.waitForFunction(() => document.body.dataset.reactMounted === "true")
    if ((await reactInput.inputValue()) !== "Ada@Example.com") {
      throw new Error("React initial values were not applied to the uncontrolled input")
    }
    if ((await reactPage.locator("form").getAttribute("novalidate")) === null) {
      throw new Error("React <Form> did not enforce noValidate")
    }
    if ((await reactPage.locator("body").getAttribute("data-react-forwarded-ref")) !== "true") {
      throw new Error("React <Form> did not merge the forwarded ref")
    }
    const reactRenders = await reactPage.evaluate(() => Reflect.get(window, "reactFieldRenders"))
    await reactPage.getByText("Server error", { exact: true }).click()
    if (
      (await reactPage.evaluate(() => Reflect.get(window, "reactFieldRenders"))) !== reactRenders
    ) {
      throw new Error("An unrelated React form error rerendered useField()")
    }
    await reactInput.fill("invalid")
    await reactInput.blur()
    await reactPage.getByText("Invalid email address", { exact: true }).waitFor()
    await reactInput.fill("GRACE@EXAMPLE.COM")
    await reactPage.getByText("Clear server error", { exact: true }).click()
    await reactPage.getByText("Save", { exact: true }).click()
    await reactPage.getByText("grace@example.com", { exact: true }).waitFor()
    if (reactErrors.length > 0) throw new Error(`React browser errors:\n${reactErrors.join("\n")}`)

    const vuePage = await browser.newPage()
    const vueErrors: string[] = []
    vuePage.on("pageerror", (error) => vueErrors.push(error.message))
    vuePage.on("console", (message) => {
      if (message.type() === "error") vueErrors.push(message.text())
    })
    await vuePage.goto(`${origin}/vue`)
    const vueInput = vuePage.locator('input[name="email"]')
    await vueInput.waitFor({ timeout: 5_000 }).catch(() => {
      throw new Error(`Vue fixture did not mount:\n${vueErrors.join("\n")}`)
    })
    await vuePage.waitForFunction(() => document.body.dataset.vueMounted === "true")
    if ((await vueInput.inputValue()) !== "Ada@Example.com") {
      throw new Error("Vue initial values were not applied to the uncontrolled input")
    }
    const vueRenders = await vuePage.evaluate(() => Reflect.get(window, "vueFieldRenders"))
    await vuePage.getByText("Server error", { exact: true }).click()
    if ((await vuePage.evaluate(() => Reflect.get(window, "vueFieldRenders"))) !== vueRenders) {
      throw new Error("An unrelated Vue form error rerendered useField()")
    }
    await vueInput.fill("invalid")
    await vueInput.blur()
    await vuePage.getByText("Invalid email address", { exact: true }).waitFor()
    await vuePage.getByText("Switch field", { exact: true }).click()
    if ((await vuePage.locator("[data-vue-field-error]").textContent()) !== "") {
      throw new Error("Vue useField() did not resubscribe after its reactive name changed")
    }
    await vuePage.getByText("Switch field", { exact: true }).click()
    await vuePage.getByText("Invalid email address", { exact: true }).waitFor()
    await vueInput.fill("GRACE@EXAMPLE.COM")
    await vuePage.getByText("Clear server error", { exact: true }).click()
    await vuePage.getByText("Save", { exact: true }).click()
    await vuePage.getByText("grace@example.com", { exact: true }).waitFor()
    if (vueErrors.length > 0) throw new Error(`Vue browser errors:\n${vueErrors.join("\n")}`)
  } finally {
    await browser.close()
    server.stop(true)
  }
  terminal.success(`${browserName} Vue and React adapter smoke tests passed`)
} finally {
  await rm(temporaryRoot, { force: true, recursive: true })
}
