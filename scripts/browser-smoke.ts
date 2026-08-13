import { resolve, sep } from "node:path"
import { chromium } from "playwright"

const root = resolve(import.meta.dir, "..")
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
    const filePath = resolve(root, `.${decodeURIComponent(url.pathname)}`)
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
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

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(server.url.href)
  const result = await page.evaluate(async (moduleUrl) => {
    try {
      const module = await import(moduleUrl)
      return module.smokePassed === true ? "ok" : "Smoke module did not report success"
    } catch (error) {
      return error instanceof Error ? (error.stack ?? error.message) : String(error)
    }
  }, new URL("/tests/compat/runtime-smoke.mjs", server.url).href)
  if (result !== "ok") throw new Error(result)
} finally {
  await browser.close()
  server.stop(true)
}
