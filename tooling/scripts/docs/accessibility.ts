import { existsSync, readdirSync, readFileSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, relative, resolve, sep } from "node:path"
import AxeBuilder from "@axe-core/playwright"
import { chromium, type Page } from "playwright"
import { terminal } from "../shared/console.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const outputRoot = join(repositoryRoot, "apps", "docs", "dist")
const stylesheetPath = join(repositoryRoot, "apps", "docs", "src", "styles", "global.css")

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
}

const walk = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })

const toRoute = (filePath: string): string => {
  const outputPath = relative(outputRoot, filePath).split(sep).join("/")
  if (outputPath === "index.html") return "/"
  if (outputPath.endsWith("/index.html")) return `/${outputPath.slice(0, -"index.html".length)}`
  return `/${outputPath}`
}

const routes = walk(outputRoot)
  .filter((filePath) => filePath.endsWith(".html"))
  .map(toRoute)
  .sort()

if (routes.length === 0) throw new Error("No generated documentation routes were found")

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname)
  const requestedPath = resolve(outputRoot, `.${pathname}`)
  const candidates = pathname.endsWith("/")
    ? [join(requestedPath, "index.html")]
    : [requestedPath, `${requestedPath}.html`, join(requestedPath, "index.html")]

  for (const filePath of candidates) {
    if (filePath !== outputRoot && !filePath.startsWith(`${outputRoot}${sep}`)) continue
    if (!existsSync(filePath)) continue
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    })
    response.end(readFileSync(filePath))
    return
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
  response.end("Not found")
})
await new Promise<void>((resolveListening) => server.listen(0, "127.0.0.1", resolveListening))
const serverAddress = server.address()
if (!serverAddress || typeof serverAddress === "string") {
  throw new Error("Documentation test server did not expose a TCP address")
}
const serverUrl = new URL(`http://127.0.0.1:${serverAddress.port}`)

type Theme = "dark" | "light"

interface AccessibilityFailure {
  readonly help: string
  readonly impact: string | null
  readonly nodes: readonly string[]
  readonly route: string
  readonly rule: string
  readonly theme: Theme
}

const navigateToRoute = async (page: Page, route: string): Promise<void> => {
  const url = new URL(route, serverUrl).href
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await page.goto(url, { waitUntil: "domcontentloaded" })
    if (response?.ok()) return
    if (attempt < 3) await Bun.sleep(50 * attempt)
  }

  throw new Error(`${route} did not return a successful response after 3 attempts`)
}

const auditPage = async (
  page: Page,
  route: string,
  theme: Theme,
): Promise<readonly AccessibilityFailure[]> => {
  await navigateToRoute(page, route)
  await page.evaluate(
    () => new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame())),
  )

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze()

  return results.violations.map((violation) => ({
    help: violation.help,
    impact: violation.impact ?? null,
    nodes: violation.nodes.flatMap((node) => node.target.map(String)),
    route,
    rule: violation.id,
    theme,
  }))
}

const hexToLuminance = (hex: string): number => {
  const weights = [0.2126, 0.7152, 0.0722] as const
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  )
  return channels
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * (weights[index] ?? 0), 0)
}

const contrastRatio = (foreground: string, background: string): number => {
  const luminances = [hexToLuminance(foreground), hexToLuminance(background)].sort(
    (left, right) => right - left,
  )
  const [lighter = 0, darker = 0] = luminances
  return (lighter + 0.05) / (darker + 0.05)
}

const parseTokens = (block: string): Readonly<Record<string, string>> =>
  Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*(#[\da-fA-F]{6})\s*;/g)].flatMap((match) => {
      const name = match[1]
      const value = match[2]
      return name && value ? [[name, value.toLowerCase()] as const] : []
    }),
  )

const stylesheet = readFileSync(stylesheetPath, "utf8")
const darkBlock = stylesheet.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1]
const lightBlock = stylesheet.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)?.[1]
if (!darkBlock || !lightBlock) throw new Error("Could not read documentation theme tokens")

const palettes = {
  dark: parseTokens(darkBlock),
  light: { ...parseTokens(darkBlock), ...parseTokens(lightBlock) },
} as const

const palettePairs = [
  ["--kern-color-text-strong", "--sl-color-bg", 7],
  ["--kern-color-text-body", "--sl-color-bg", 7],
  ["--kern-color-text-muted", "--sl-color-bg", 7],
  ["--kern-color-text-muted", "--sl-color-gray-5", 5],
  ["--kern-color-text-elevated", "--sl-color-gray-5", 5],
  ["--kern-color-interactive", "--sl-color-bg-inline-code", 7],
  ["--kern-color-focus", "--sl-color-bg", 3.5],
  ["--kern-color-functional-border", "--sl-color-bg", 3.5],
  ["--kern-color-selection-text", "--kern-color-selection-bg", 4.5],
  ["--kern-color-syntax-keyword", "--sl-color-bg", 7],
  ["--kern-color-syntax-string", "--sl-color-bg", 7],
  ["--kern-color-syntax-function", "--sl-color-bg", 7],
  ["--kern-color-syntax-number", "--sl-color-bg", 7],
] as const

for (const [theme, palette] of Object.entries(palettes) as readonly [
  Theme,
  typeof palettes.dark,
][]) {
  for (const [foregroundToken, backgroundToken, minimum] of palettePairs) {
    const foreground = palette[foregroundToken]
    const background = palette[backgroundToken]
    if (!foreground || !background) {
      throw new Error(`${theme} palette is missing ${foregroundToken} or ${backgroundToken}`)
    }
    const ratio = contrastRatio(foreground, background)
    if (ratio < minimum) {
      throw new Error(
        `${theme} ${foregroundToken} on ${backgroundToken} is ${ratio.toFixed(2)}:1; expected ${minimum}:1`,
      )
    }
  }
}

const browser = await chromium.launch({ headless: true })
const failures: AccessibilityFailure[] = []

try {
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      colorScheme: theme,
      viewport: { width: 1440, height: 900 },
    })
    await context.addInitScript((selectedTheme) => {
      localStorage.setItem("starlight-theme", selectedTheme)
    }, theme)
    const workerCount = Math.min(4, routes.length)
    const pages = await Promise.all(
      Array.from({ length: workerCount }, async () => await context.newPage()),
    )
    let auditedRoutes = 0

    await Promise.all(
      pages.map(async (page, workerIndex) => {
        for (let index = workerIndex; index < routes.length; index += workerCount) {
          const route = routes[index]
          if (!route) continue
          failures.push(...(await auditPage(page, route, theme)))
          auditedRoutes += 1
          if (auditedRoutes % 25 === 0) {
            terminal.info(`${theme}: audited ${auditedRoutes}/${routes.length} routes`)
          }
        }
      }),
    )

    await context.close()
  }
} finally {
  await browser.close()
  server.closeAllConnections()
  server.close()
}

if (failures.length > 0) {
  const details = failures
    .map(
      (failure) =>
        `${failure.theme} ${failure.route} [${failure.impact ?? "unknown"}] ${failure.rule}: ${failure.help}\n  ${failure.nodes.join("\n  ")}`,
    )
    .join("\n")
  throw new Error(`${failures.length} accessibility violation(s) found:\n${details}`)
}

terminal.success(`${routes.length} routes passed WCAG A/AA checks in light and dark themes`)
