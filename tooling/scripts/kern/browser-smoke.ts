import { join, resolve, sep } from "node:path"
import { chromium, firefox, webkit } from "playwright"
import { terminal } from "../shared/console.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const packageRoot = join(repositoryRoot, "packages", "kern")
const browserName =
  process.argv.find((argument) => argument.startsWith("--browser="))?.slice(10) ?? "chromium"
const browserType = { chromium, firefox, webkit }[browserName as "chromium" | "firefox" | "webkit"]
if (!browserType) throw new Error(`Unsupported browser engine: ${browserName}`)
const contentTypes: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/")
      return new Response("<!doctype html><title>Kern smoke</title>", {
        headers: { "content-type": contentTypes[".html"] as string },
      })
    const filePath = resolve(packageRoot, `.${decodeURIComponent(url.pathname)}`)
    if (filePath !== packageRoot && !filePath.startsWith(`${packageRoot}${sep}`)) {
      return new Response("Forbidden", { status: 403 })
    }
    const file = Bun.file(filePath)
    if (!(await file.exists())) return new Response("Not found", { status: 404 })
    const extension = filePath.slice(filePath.lastIndexOf("."))
    return new Response(file, {
      headers: { "content-type": contentTypes[extension] ?? "application/octet-stream" },
    })
  },
})

const browser = await browserType.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(server.url.href)
  const result = await page.evaluate(async (moduleUrl) => {
    let lastError = "Browser smoke module did not load"
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const module = await import(`${moduleUrl}?attempt=${attempt}`)
        return module.smokePassed === true ? "ok" : "Smoke module did not report success"
      } catch (error) {
        lastError = error instanceof Error ? (error.stack ?? error.message) : String(error)
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }
    return lastError
  }, new URL("/tests/compat/runtime-smoke.mjs", server.url).href)
  if (result !== "ok") throw new Error(result)
} finally {
  await browser.close()
  server.stop(true)
}

terminal.success(`${browserName} smoke test passed`)
