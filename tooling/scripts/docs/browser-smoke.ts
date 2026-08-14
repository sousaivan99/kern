import { join, resolve, sep } from "node:path"
import { chromium } from "playwright"
import { terminal } from "../shared/console.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const outputRoot = join(repositoryRoot, "apps", "docs", "dist")
const routes = [
  "/",
  "/getting-started/installation/",
  "/getting-started/from-zero/",
  "/frameworks/javascript-typescript/",
  "/frameworks/vue/",
  "/frameworks/nuxt/",
  "/frameworks/react/",
  "/concepts/glossary/",
  "/measurements/package-size/",
  "/measurements/validation-benchmarks/",
  "/modules/",
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
  "/measurements/package-size/",
  "/modules/validation/",
  "/modules/array/",
  "/reference/validation/functions/object/",
] as const
const runnableExamples = [
  {
    route: "/getting-started/from-zero/",
    marker: "const distinctNames = unique(names)",
    output: '["Ada", "Grace"]\n["Ada", "Grace", "Ada"]',
  },
  {
    route: "/modules/array/",
    marker: "console.log(first(names))",
    output: 'Ada\n["Ada", "Grace"]\n["Ada", "Grace", "Ada"]',
  },
  {
    route: "/modules/async/",
    marker: "async function greetLater",
    output:
      "Waiting\nHello\n\nThrown error:\nRangeError: Delay must be a non-negative finite number",
    state: "error",
  },
  {
    route: "/modules/date/",
    marker: "const followUp = addDays(release, 7)",
    output: "13/08/2026\ntrue\n2026-08-13\n\nThrown error:\nRangeError: Expected a valid Date",
    state: "error",
  },
  {
    route: "/modules/money/",
    marker: "const total = addMoney(coffee, cake)",
    output:
      "849\n€8.49\n\nThrown error:\nRangeError: Money values must be safe integers in minor units",
    state: "error",
  },
  {
    route: "/modules/number/",
    marker: "const safeVolume = clamp(requestedVolume, 0, 100)",
    output: "100\n100\n\nThrown error:\nRangeError: Minimum cannot be greater than maximum",
    state: "error",
  },
  {
    route: "/modules/object/",
    marker: 'passwordHash: "secret"',
    output: 'true\n{ "id": 1, "name": "Ada" }\n\nThrown error:\nTypeError: Expected a plain object',
    state: "error",
  },
  {
    route: "/modules/string/",
    marker: "const slug = slugify(title)",
    output:
      "Crème brûlée\ncreme-brulee\ncrème brûlée\n\nThrown error:\nRangeError: Invalid language tag: not_a_locale",
    state: "error",
  },
  {
    route: "/modules/validation/",
    marker: "const goodInput: unknown",
    output:
      'Success: { "success": true, "data": { "name": "Ada" } }\nFailure: { "success": false, "issues": [{ "path": ["name"], "code": "too_small", "message": "Expected at least 1 characters", "received": "string", "details": { "minimum": 1 } }] }',
  },
] as const

const exampleControlRoutes = [
  "/concepts/native-first/",
  "/concepts/tree-shaking/",
  "/contributing/development/",
  "/frameworks/javascript-typescript/",
  "/frameworks/nuxt/",
  "/frameworks/react/",
  "/frameworks/vue/",
  "/getting-started/from-zero/",
  "/getting-started/installation/",
  "/getting-started/quick-start/",
  "/getting-started/core-ideas/",
  "/modules/",
  "/modules/validation/",
  "/modules/validation/primitives/",
  "/modules/validation/collections/",
  "/modules/validation/modifiers-and-transforms/",
  "/modules/validation/errors-and-inference/",
  "/modules/money/",
  "/modules/money/arithmetic/",
  "/modules/money/formatting-and-parsing/",
  "/modules/date/",
  "/modules/date/arithmetic-and-boundaries/",
  "/modules/date/formatting-and-comparison/",
  "/modules/number/",
  "/modules/string/",
  "/modules/array/",
  "/modules/object/",
  "/modules/async/",
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
  const browserErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))
  for (const route of routes) {
    browserErrors.length = 0
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
    if (browserErrors.length > 0) {
      throw new Error(`${route} reported browser errors:\n${browserErrors.join("\n")}`)
    }
  }

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(new URL("/", server.url).href)
  const heroLinkCenters = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".kern-primary-links a"), (link) => {
      const rectangle = link.getBoundingClientRect()
      return Math.round(rectangle.top + rectangle.height / 2)
    }),
  )
  if (
    heroLinkCenters.length === 0 ||
    Math.max(...heroLinkCenters) - Math.min(...heroLinkCenters) > 2
  ) {
    throw new Error(
      `Homepage hero links wrap onto mismatched rows at desktop width: ${JSON.stringify(heroLinkCenters)}`,
    )
  }

  for (const example of runnableExamples) {
    await page.goto(new URL(example.route, server.url).href)
    const exampleBlock = page.locator(".expressive-code").filter({ hasText: example.marker })
    if ((await exampleBlock.count()) !== 1) {
      throw new Error(`${example.route} must have one example containing ${example.marker}`)
    }

    const consolePanel = exampleBlock.locator(":scope > .kern-example-console")
    if ((await consolePanel.count()) !== 1) {
      throw new Error(`${example.route} example must have exactly one inline console`)
    }

    const runButton = consolePanel.getByRole("button", { name: /^Run example:/ })
    if ((await runButton.count()) !== 1) {
      throw new Error(`${example.route} runnable example must have one Run example button`)
    }

    const layoutBeforeRun = {
      documentHeight: await page.evaluate(() => document.documentElement.scrollHeight),
      panelHeight: await consolePanel.evaluate((panel) => panel.getBoundingClientRect().height),
    }

    await runButton.click()
    const expectedState = "state" in example ? example.state : "success"
    await page.waitForFunction(
      ({ marker, state }) =>
        Array.from(document.querySelectorAll(".expressive-code")).some(
          (block) =>
            block.textContent?.includes(marker) &&
            block.querySelector(":scope > .kern-example-console")?.getAttribute("data-state") ===
              state,
        ),
      { marker: example.marker, state: expectedState },
    )

    const output = await consolePanel.locator("output").innerText()
    if (output !== example.output) {
      throw new Error(
        `${example.route} produced unexpected console output: ${JSON.stringify(output)}`,
      )
    }

    const layoutAfterRun = {
      documentHeight: await page.evaluate(() => document.documentElement.scrollHeight),
      panelHeight: await consolePanel.evaluate((panel) => panel.getBoundingClientRect().height),
    }
    if (
      layoutAfterRun.documentHeight !== layoutBeforeRun.documentHeight ||
      layoutAfterRun.panelHeight !== layoutBeforeRun.panelHeight
    ) {
      throw new Error(`${example.route} shifts content when its example runs`)
    }
  }

  for (const route of exampleControlRoutes) {
    await page.goto(new URL(route, server.url).href)
    const controlCoverage = await page.evaluate(() => {
      const examples = Array.from(
        document.querySelectorAll(
          "main figure.frame:has(pre[data-language='ts'], pre[data-language='typescript'], pre[data-language='js'], pre[data-language='javascript'], pre[data-language='tsx'], pre[data-language='jsx'], pre[data-language='vue'])",
        ),
      )
      const results = examples.map((example) => {
        const source =
          example
            .querySelector<HTMLButtonElement>("button[data-code]")
            ?.dataset.code?.replaceAll("\u007f", "\n") ?? ""
        const hasConsoleLog = source.includes("console.log")
        const consoleCount =
          example.closest(".expressive-code")?.querySelectorAll(":scope > .kern-example-console")
            .length ?? 0
        return { consoleCount, hasConsoleLog }
      })
      return {
        examples: examples.length,
        consoleExamples: results.filter((result) => result.hasConsoleLog).length,
        inlineConsoles: results.reduce((count, result) => count + result.consoleCount, 0),
        invalid: results.filter((result) => result.consoleCount !== (result.hasConsoleLog ? 1 : 0))
          .length,
        modalCount: document.querySelectorAll(".kern-code-dialog").length,
        headerControlCount: document.querySelectorAll(
          ".kern-code-example-run, .kern-code-example-label",
        ).length,
      }
    })
    if (
      controlCoverage.invalid !== 0 ||
      controlCoverage.consoleExamples !== controlCoverage.inlineConsoles ||
      controlCoverage.modalCount !== 0 ||
      controlCoverage.headerControlCount !== 0
    ) {
      throw new Error(
        `${route} does not use exactly one inline console for each console.log example: ${JSON.stringify(controlCoverage)}`,
      )
    }
  }

  await page.goto(new URL("/modules/validation/", server.url).href)
  const playground = page.locator("[data-validation-playground]")
  const playgroundSource = playground.locator("[data-playground-source]")
  const playgroundOutput = playground.locator("[data-playground-output]")
  await page.waitForFunction(
    () =>
      document.querySelector("[data-validation-playground]")?.getAttribute("data-state") ===
      "success",
  )
  if (!(await playgroundOutput.innerText()).includes('"success": true')) {
    throw new Error("Validation playground does not run its initial source")
  }

  await playgroundSource.fill(`import { object, string } from "@sousaivan/kern/validation"
const User = object({ name: string().min(2), email: string().email() })
console.log(User.safeParse({ name: "A", email: "bad" }))`)
  await page.waitForFunction(
    () =>
      document.querySelector("[data-validation-playground]")?.getAttribute("data-state") ===
        "success" &&
      document.querySelector("[data-playground-output]")?.textContent?.includes('"success": false'),
  )
  if (!(await playgroundOutput.innerText()).includes("invalid_email")) {
    throw new Error("Validation playground does not expose structured validation issues")
  }

  await playgroundSource.fill("const = broken")
  await page.waitForFunction(
    () =>
      document.querySelector("[data-validation-playground]")?.getAttribute("data-state") ===
      "error",
  )
  if (!(await playgroundOutput.innerText()).startsWith("SyntaxError:")) {
    throw new Error("Validation playground does not report syntax errors")
  }

  await playgroundSource.fill('import { z } from "zod"\nconsole.log(z)')
  await page.waitForFunction(() =>
    document
      .querySelector("[data-playground-output]")
      ?.textContent?.includes('Only "@sousaivan/kern/validation" can be imported.'),
  )

  await playgroundSource.fill("while (true) {}")
  await page.waitForFunction(
    () =>
      document.querySelector("[data-playground-output]")?.textContent ===
      "Execution stopped after 1 second.",
  )
  await playground.getByRole("button", { name: "Reset", exact: true }).click()
  await page.waitForFunction(
    () =>
      document.querySelector("[data-validation-playground]")?.getAttribute("data-state") ===
        "success" &&
      document.querySelector("[data-playground-output]")?.textContent?.includes('"success": true'),
  )

  const safeParseExample = page
    .locator(".expressive-code")
    .filter({ hasText: "const goodResult = Login.safeParse" })
  const safeParseConsole = safeParseExample.locator(":scope > .kern-example-console")
  await safeParseConsole
    .getByRole("button", { name: "Run example: safeParse or parse?", exact: true })
    .click()
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".expressive-code")).some(
      (block) =>
        block.textContent?.includes("const goodResult = Login.safeParse") &&
        block.querySelector(":scope > .kern-example-console")?.getAttribute("data-state") ===
          "success",
    ),
  )
  const safeParseOutput = await safeParseConsole.locator("output").innerText()
  if (
    !safeParseOutput.includes('Success: { "success": true') ||
    !safeParseOutput.includes('Failure: { "success": false') ||
    !safeParseOutput.includes('"code": "invalid_email"')
  ) {
    throw new Error(`safeParse example does not show success and failure: ${safeParseOutput}`)
  }

  const parseExample = page
    .locator(".expressive-code")
    .filter({ hasText: 'console.log("Error message:", error.message)' })
  const parseConsole = parseExample.locator(":scope > .kern-example-console")
  await parseConsole
    .getByRole("button", { name: "Run example: safeParse or parse?", exact: true })
    .click()
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".expressive-code")).some(
      (block) =>
        block.textContent?.includes('console.log("Error message:", error.message)') &&
        block.querySelector(":scope > .kern-example-console")?.getAttribute("data-state") ===
          "success",
    ),
  )
  const parseOutput = await parseConsole.locator("output").innerText()
  if (
    !parseOutput.includes('Success: { "email": "ada@example.com" }') ||
    !parseOutput.includes("Error message: Invalid email address") ||
    !parseOutput.includes('"code": "invalid_email"')
  ) {
    throw new Error(`parse example does not show success and error details: ${parseOutput}`)
  }

  await page.goto(new URL("/modules/money/arithmetic/", server.url).href)
  const addMoneyExample = page
    .locator(".expressive-code")
    .filter({ hasText: 'console.log("Success:", addMoney' })
  const addMoneyConsole = addMoneyExample.locator(":scope > .kern-example-console")
  const addMoneyLayoutBefore = {
    documentHeight: await page.evaluate(() => document.documentElement.scrollHeight),
    panelHeight: await addMoneyConsole.evaluate((panel) => panel.getBoundingClientRect().height),
  }
  await addMoneyConsole
    .getByRole("button", {
      name: "Run example: addMoney(leftMinorUnits, rightMinorUnits)",
      exact: true,
    })
    .click()
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".expressive-code")).some(
      (block) =>
        block.textContent?.includes('console.log("Success:", addMoney') &&
        block.querySelector(":scope > .kern-example-console")?.getAttribute("data-state") ===
          "error",
    ),
  )
  const addMoneyOutput = await addMoneyConsole.locator("output").innerText()
  if (
    addMoneyOutput !==
    "Success: 1349\n\nThrown error:\nRangeError: Money values must be safe integers in minor units"
  ) {
    throw new Error(
      `addMoney example does not preserve success before its error: ${addMoneyOutput}`,
    )
  }
  const addMoneyLayoutAfter = {
    documentHeight: await page.evaluate(() => document.documentElement.scrollHeight),
    panelHeight: await addMoneyConsole.evaluate((panel) => panel.getBoundingClientRect().height),
  }
  if (
    addMoneyLayoutAfter.documentHeight !== addMoneyLayoutBefore.documentHeight ||
    addMoneyLayoutAfter.panelHeight !== addMoneyLayoutBefore.panelHeight
  ) {
    throw new Error("Running the inline example console shifts the document layout")
  }

  await page.setViewportSize({ width: 2048, height: 1200 })
  await page.goto(new URL("/", server.url).href)
  const homepageCanvas = await page.locator("main .sl-container").first().boundingBox()
  if (!homepageCanvas || homepageCanvas.width < 1400) {
    throw new Error("Homepage documentation canvas is too narrow at wide desktop width")
  }
  const lucideIconCount = await page.locator("main svg.lucide").count()
  if (lucideIconCount < 6) throw new Error("Homepage is not using the Lucide icon system")
  const homepageText = await page.locator("main").innerText()
  if (/\p{Emoji_Presentation}/u.test(homepageText)) {
    throw new Error("Homepage contains emoji instead of package icons")
  }
  if ((await page.locator("main h1").innerText()) !== "Kern") {
    throw new Error("Homepage must use Kern as its heading-one value proposition")
  }
  if (
    !homepageText.includes(
      "Small, dependency-free TypeScript primitives for everyday application code.",
    ) ||
    !homepageText.includes("Validation · Money · Dates · Async · Data") ||
    !homepageText.includes("Zero runtime dependencies · Tree-shakeable · Standard Schema")
  ) {
    throw new Error("Homepage value proposition is incomplete")
  }
  if ((await page.locator(".kern-home-example").count()) !== 3) {
    throw new Error("Homepage must show exactly three examples")
  }
  for (const target of ["/measurements/package-size/", "/modules/validation/#playground"]) {
    if ((await page.locator(`a[href$="${target}"]`).count()) === 0) {
      throw new Error(`Homepage is missing its ${target} link`)
    }
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

  const referenceResponse = await page.goto(
    new URL("/reference/validation/functions/object/", server.url).href,
  )
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

  const mobileChunkExample = page
    .locator(".expressive-code")
    .filter({ hasText: 'console.log("Success:", chunk' })
  const mobileConsole = mobileChunkExample.locator(":scope > .kern-example-console")
  const mobileLayoutBefore = {
    documentHeight: await page.evaluate(() => document.documentElement.scrollHeight),
    panelHeight: await mobileConsole.evaluate((panel) => panel.getBoundingClientRect().height),
  }
  await mobileConsole
    .getByRole("button", { name: "Run example: Create batches with chunk", exact: true })
    .click()
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".expressive-code")).some(
      (block) =>
        block.textContent?.includes('console.log("Success:", chunk') &&
        block.querySelector(":scope > .kern-example-console")?.getAttribute("data-state") ===
          "error",
    ),
  )
  const mobileConsoleBounds = await mobileConsole.boundingBox()
  if (
    !mobileConsoleBounds ||
    mobileConsoleBounds.x < 0 ||
    mobileConsoleBounds.x + mobileConsoleBounds.width > 390
  ) {
    throw new Error(
      `Inline example console does not fit the mobile width: ${JSON.stringify(mobileConsoleBounds)}`,
    )
  }
  const mobileLayoutAfter = {
    documentHeight: await page.evaluate(() => document.documentElement.scrollHeight),
    panelHeight: await mobileConsole.evaluate((panel) => panel.getBoundingClientRect().height),
  }
  if (
    mobileLayoutAfter.documentHeight !== mobileLayoutBefore.documentHeight ||
    mobileLayoutAfter.panelHeight !== mobileLayoutBefore.panelHeight
  ) {
    throw new Error("Running the inline console shifts mobile document content")
  }

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
  const reducedMotion = await page.evaluate(() => {
    const primaryLink = document.querySelector(".kern-primary-links a")
    if (!primaryLink) throw new Error("Primary documentation link is missing")

    return {
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration: getComputedStyle(primaryLink).transitionDuration,
    }
  })
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
