import { join, resolve, sep } from "node:path"
import { chromium } from "playwright"
import { terminal } from "../shared/console.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const outputRoot = join(repositoryRoot, "apps", "docs", "dist")
const routes = [
  "/",
  "/getting-started/installation/",
  "/modules/validation/",
  "/modules/money/",
  "/modules/date/",
  "/modules/number/",
  "/modules/string/",
  "/modules/array/",
  "/modules/object/",
  "/modules/async/",
] as const
const representativeRoutes = [
  "/",
  "/getting-started/installation/",
  "/concepts/native-first/",
  "/modules/validation/",
  "/modules/array/",
  "/reference/validation/functions/object/",
] as const

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url)
    const pathname = decodeURIComponent(url.pathname)
    const requestedPath = resolve(outputRoot, `.${pathname}`)
    const candidates = pathname.endsWith("/")
      ? [join(requestedPath, "index.html")]
      : [requestedPath, `${requestedPath}.html`, join(requestedPath, "index.html")]
    for (const filePath of candidates) {
      if (filePath !== outputRoot && !filePath.startsWith(`${outputRoot}${sep}`)) continue
      const file = Bun.file(filePath)
      if (!(await file.exists())) continue
      const extension = filePath.slice(filePath.lastIndexOf("."))
      return new Response(file, {
        headers: { "content-type": contentTypes[extension] ?? "application/octet-stream" },
      })
    }
    return new Response("Not found", { status: 404 })
  },
})

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  for (const route of routes) {
    const response = await page.goto(new URL(route, server.url).href)
    if (!response?.ok()) throw new Error(`${route} returned ${response?.status() ?? "no response"}`)
    if ((await page.locator("main h1").count()) !== 1)
      throw new Error(`${route} must have one main h1`)
    if ((await page.locator("main").count()) !== 1)
      throw new Error(`${route} must have one main landmark`)
    if ((await page.locator("html").getAttribute("lang")) !== "en")
      throw new Error(`${route} must declare English as its document language`)
    if (!(await page.title()).trim()) throw new Error(`${route} must have a meaningful page title`)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    if (overflow) throw new Error(`${route} overflows horizontally at desktop width`)
  }

  await page.setViewportSize({ width: 2048, height: 1200 })
  await page.goto(new URL("/", server.url).href)
  const homepageCanvas = await page.locator("main .sl-container").first().boundingBox()
  if (!homepageCanvas || homepageCanvas.width < 1400) {
    throw new Error("Homepage documentation canvas is too narrow at wide desktop width")
  }
  const lucideIconCount = await page.locator("main svg.lucide").count()
  if (lucideIconCount < 20) throw new Error("Homepage is not using the Lucide icon system")
  const homepageText = await page.locator("main").innerText()
  if (/\p{Emoji_Presentation}/u.test(homepageText)) {
    throw new Error("Homepage contains emoji instead of package icons")
  }

  const liveCopyStatus = page.locator("[data-copy-status][role='status'][aria-live='polite']")
  if ((await liveCopyStatus.count()) !== 1) throw new Error("Copy feedback is not announced live")
  await page.locator("[data-copy-install]").click()
  await page.waitForFunction(
    () => document.querySelector("[data-copy-status]")?.textContent?.trim().length,
  )
  if (!(await liveCopyStatus.textContent())?.trim()) {
    throw new Error("Copy interaction did not expose success or failure feedback")
  }

  await page.setViewportSize({ width: 1440, height: 900 })

  const referenceHref = await page.locator('a[href*="/reference/"]').first().getAttribute("href")
  if (!referenceHref) throw new Error("Generated API reference link was not found")
  const referenceResponse = await page.goto(new URL(referenceHref, server.url).href)
  if (!referenceResponse?.ok())
    throw new Error(`API reference returned ${referenceResponse?.status()}`)

  const searchResults = await page.evaluate(async () => {
    const pagefindUrl = "/pagefind/pagefind.js"
    const pagefind = await import(pagefindUrl)
    await pagefind.init()
    const results = await pagefind.search("formatMoney")
    return results.results.length
  })
  if (searchResults === 0) throw new Error("Pagefind could not find formatMoney")

  for (const route of ["/getting-started/installation/", "/concepts/native-first/"]) {
    await page.goto(new URL(route, server.url).href)
    const tableLayout = await page.locator("main table").evaluate((table) => {
      const tableRect = table.getBoundingClientRect()
      const lastCellRect = table.querySelector("tr > :last-child")?.getBoundingClientRect()
      return {
        display: getComputedStyle(table).display,
        tableWidth: tableRect.width,
        lastCellRight: lastCellRect?.right ?? 0,
        tableRight: tableRect.right,
      }
    })
    if (tableLayout.display !== "table") throw new Error(`${route} table is not a table grid`)
    if (tableLayout.tableWidth < 600)
      throw new Error(`${route} table does not fill its content area`)
    if (Math.abs(tableLayout.tableRight - tableLayout.lastCellRight) > 2) {
      throw new Error(`${route} table columns do not fill the table width`)
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(new URL("/modules/array/", server.url).href)
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  if (mobileOverflow) throw new Error("Documentation overflows horizontally at mobile width")
  if ((await page.locator('button[aria-label*="menu" i]').count()) === 0) {
    throw new Error("Mobile navigation control was not found")
  }

  const menuButton = page.locator('button[aria-label*="menu" i]').first()
  await menuButton.focus()
  await page.keyboard.press("Enter")
  if ((await menuButton.getAttribute("aria-expanded")) !== "true") {
    throw new Error("Mobile navigation does not open from the keyboard")
  }

  await page.keyboard.press("Escape")

  const scrollableCode = page.locator(
    'main pre[tabindex="0"][aria-label="Scrollable code example"]',
  )
  if ((await scrollableCode.count()) === 0) {
    throw new Error("Overflowing code is not keyboard accessible")
  }
  await scrollableCode.first().focus()
  const initialCodeScroll = await scrollableCode.first().evaluate((element) => element.scrollLeft)
  await page.keyboard.press("ArrowRight")
  await page.waitForTimeout(100)
  const keyboardCodeScroll = await scrollableCode.first().evaluate((element) => element.scrollLeft)
  if (keyboardCodeScroll <= initialCodeScroll) {
    throw new Error("Scrollable code does not respond to keyboard input")
  }

  const activeSidebarStyles = await page
    .locator('.sidebar-content a[aria-current="page"]')
    .evaluate((element) => {
      const styles = getComputedStyle(element)
      return {
        background: styles.backgroundColor,
        borderRadius: styles.borderRadius,
        boxShadow: styles.boxShadow,
      }
    })
  if (activeSidebarStyles.borderRadius !== "0px") {
    throw new Error("Active sidebar item must not use rounded corners")
  }
  if (activeSidebarStyles.background !== "rgba(0, 0, 0, 0)") {
    throw new Error("Active sidebar item must use a transparent background")
  }
  if (activeSidebarStyles.boxShadow === "none") {
    throw new Error("Active sidebar state is not visually distinguishable")
  }

  for (const route of representativeRoutes) {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto(new URL(route, server.url).href)
    const mobileLayout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    if (mobileLayout.scrollWidth > mobileLayout.clientWidth) {
      throw new Error(`${route} does not reflow at 320 CSS pixels`)
    }

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
    const resizedTextOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    if (resizedTextOverflow) throw new Error(`${route} overflows with text resized to 200%`)

    await page.reload()
    await page.addStyleTag({
      content:
        "p, li, td, th, a, button, summary { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }",
    })
    const textSpacingOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    if (textSpacingOverflow) throw new Error(`${route} overflows with WCAG text spacing`)
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(new URL("/", server.url).href)
  await page.keyboard.press("Tab")
  const firstFocus = await page.evaluate(() => ({
    focusVisible: document.activeElement?.matches(":focus-visible") ?? false,
    text: document.activeElement?.textContent?.trim(),
  }))
  if (firstFocus.text !== "Skip to content" || !firstFocus.focusVisible) {
    throw new Error("The visible skip link must be the first keyboard destination")
  }

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab")
    await page.waitForTimeout(350)
    const focusState = await page.evaluate(() => {
      const element = document.activeElement
      if (!(element instanceof HTMLElement)) return null
      const rect = element.getBoundingClientRect()
      const inHeader = element.closest("header.header") !== null
      const headerBottom =
        document.querySelector("header.header")?.getBoundingClientRect().bottom ?? 0
      return {
        focusVisible: element.matches(":focus-visible"),
        label: (element.getAttribute("aria-label") ?? element.textContent ?? "")
          .trim()
          .slice(0, 60),
        visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
        unobscured: inHeader || rect.bottom > headerBottom,
      }
    })
    if (!focusState?.focusVisible || !focusState.visible || !focusState.unobscured) {
      throw new Error(
        `Keyboard destination ${index + 2} is hidden or lacks visible focus: ${JSON.stringify(focusState)}`,
      )
    }
  }

  await page.emulateMedia({ contrast: "more" })
  const increasedContrast = await page.locator(".kern-support-line").evaluate((element) => ({
    body: getComputedStyle(document.documentElement)
      .getPropertyValue("--kern-color-text-body")
      .trim(),
    muted: getComputedStyle(element).color,
  }))
  const resolvedBodyColor = await page.evaluate(() => {
    const probe = document.createElement("span")
    probe.style.color = "var(--kern-color-text-body)"
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })
  if (increasedContrast.muted !== resolvedBodyColor) {
    throw new Error(
      `Increased-contrast preference does not promote secondary text: ${JSON.stringify({ increasedContrast, resolvedBodyColor })}`,
    )
  }

  await page.emulateMedia({ contrast: "no-preference", reducedMotion: "reduce" })
  const reducedMotion = await page.evaluate(() => ({
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    transitionDuration: getComputedStyle(document.querySelector(".kern-primary-links a")!)
      .transitionDuration,
  }))
  if (reducedMotion.scrollBehavior !== "auto" || reducedMotion.transitionDuration !== "0s") {
    throw new Error("Reduced-motion preference does not disable decorative motion")
  }

  await page.emulateMedia({ forcedColors: "active", reducedMotion: "no-preference" })
  await page.goto(new URL("/modules/array/", server.url).href)
  await page.locator('.sidebar-content a[aria-current="page"]').focus()
  const forcedColorFocus = await page
    .locator('.sidebar-content a[aria-current="page"]')
    .evaluate((element) => getComputedStyle(element).outlineStyle)
  if (forcedColorFocus === "none") throw new Error("Forced-colour mode loses visible focus")

  await page.emulateMedia({ forcedColors: "none" })

  await page.evaluate(() => {
    localStorage.setItem("starlight-theme", "dark")
  })
  await page.reload()
  const theme = await page.locator("html").getAttribute("data-theme")
  if (theme !== "dark") throw new Error("Dark theme preference was not applied")

  terminal.success(
    `${routes.length} docs routes, accessibility preferences, keyboard paths, and responsive layouts passed`,
  )
} finally {
  await browser.close()
  server.stop(true)
}
