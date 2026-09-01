import { resolve, sep } from "node:path"
import { chromium } from "playwright"
import { terminal } from "../scripts/shared/console.js"

interface BrowserMeasurement {
  readonly medianMilliseconds: number
  readonly p95Milliseconds: number
  readonly scenario: string
  readonly size: number
}

const repositoryRoot = resolve(import.meta.dir, "../..")
const entrypoint = resolve(repositoryRoot, "packages/form/dist/index.js")
if (!(await Bun.file(entrypoint).exists())) {
  throw new Error("Build @lithekit/form before running its browser benchmarks")
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/") {
      return new Response("<!doctype html><title>Lithekit Form browser benchmarks</title>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    const filePath = resolve(repositoryRoot, `.${decodeURIComponent(url.pathname)}`)
    if (filePath !== repositoryRoot && !filePath.startsWith(`${repositoryRoot}${sep}`)) {
      return new Response("Forbidden", { status: 403 })
    }
    const file = Bun.file(filePath)
    if (!(await file.exists())) return new Response("Not found", { status: 404 })
    return new Response(file, { headers: { "content-type": "text/javascript" } })
  },
})

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(server.url.href)
  const results = await page.evaluate(async (moduleUrl): Promise<BrowserMeasurement[]> => {
    const { createForm } = await import(moduleUrl)
    const sizes = [10, 100, 1_000]
    let sink: unknown

    const percentile = (values: readonly number[], percentage: number): number => {
      const sorted = [...values].sort((left, right) => left - right)
      return sorted[Math.max(0, Math.ceil(sorted.length * percentage) - 1)] ?? 0
    }
    const record = (
      scenario: string,
      size: number,
      samples: readonly number[],
    ): BrowserMeasurement => ({
      medianMilliseconds: percentile(samples, 0.5),
      p95Milliseconds: percentile(samples, 0.95),
      scenario,
      size,
    })
    const createElement = (size: number): HTMLFormElement => {
      const form = document.createElement("form")
      const fragment = document.createDocumentFragment()
      for (let index = 0; index < size; index += 1) {
        const input = document.createElement("input")
        input.name = `field${index}`
        input.defaultValue = `value${index}`
        fragment.append(input)
      }
      form.append(fragment)
      document.body.append(form)
      return form
    }
    const target = (form: HTMLFormElement, size: number): HTMLInputElement => {
      const control = form.elements.namedItem(`field${Math.floor(size / 2)}`)
      if (!(control instanceof HTMLInputElement)) throw new Error("Missing benchmark input")
      return control
    }
    const values = (size: number, suffix: string): Record<string, string> =>
      Object.fromEntries(
        Array.from({ length: size }, (_, index) => [`field${index}`, `value${index}-${suffix}`]),
      )
    const schema = {
      "~standard": {
        version: 1,
        vendor: "form-browser-benchmark",
        validate(value: unknown) {
          let checksum = 0
          if (typeof value === "object" && value !== null) {
            for (const field of Object.values(value)) checksum += String(field).length
          }
          sink = checksum
          return { value }
        },
      },
    }

    const measurements: BrowserMeasurement[] = []
    for (const size of sizes) {
      const attachSamples: number[] = []
      const fieldSamples: number[] = []
      for (let sample = 0; sample < 18; sample += 1) {
        const form = createElement(size)
        const started = performance.now()
        const controller = createForm({ schema, validateOn: "submit" })
        controller.attach(form)
        const attached = performance.now()
        for (let index = 0; index < size; index += 1) controller.field(`field${index}`)
        const fieldsCreated = performance.now()
        if (sample >= 3) {
          attachSamples.push(attached - started)
          fieldSamples.push(fieldsCreated - attached)
        }
        controller.dispose()
        form.remove()
      }
      measurements.push(record("attach and decode", size, attachSamples))
      measurements.push(record("create field signals", size, fieldSamples))

      const form = createElement(size)
      const controller = createForm({ schema, validateOn: "submit" })
      controller.attach(form)
      const input = target(form, size)
      const iterations = size === 1_000 ? 40 : size === 100 ? 200 : 800
      for (let index = 0; index < 20; index += 1) {
        input.value = `warm-${index}`
        input.dispatchEvent(new InputEvent("input", { bubbles: true }))
      }
      const inputSamples: number[] = []
      for (let sample = 0; sample < 15; sample += 1) {
        const started = performance.now()
        for (let index = 0; index < iterations; index += 1) {
          input.value = `${sample}-${index}`
          input.dispatchEvent(new InputEvent("input", { bubbles: true }))
        }
        inputSamples.push((performance.now() - started) / iterations)
      }
      measurements.push(record("input reconciliation", size, inputSamples))

      const validationSamples: number[] = []
      for (let sample = 0; sample < 15; sample += 1) {
        input.value = `validated-${sample}`
        input.dispatchEvent(new InputEvent("input", { bubbles: true }))
        const started = performance.now()
        await controller.validate()
        validationSamples.push(performance.now() - started)
      }
      measurements.push(record("explicit full validation", size, validationSamples))

      const nextA = values(size, "a")
      const nextB = values(size, "b")
      const resetSamples: number[] = []
      for (let sample = 0; sample < 15; sample += 1) {
        const started = performance.now()
        controller.reset(sample % 2 === 0 ? nextA : nextB)
        resetSamples.push(performance.now() - started)
      }
      measurements.push(record("reset", size, resetSamples))

      for (let index = 0; index < size; index += 1) controller.field(`field${index}`)
      const externalErrors = Object.fromEntries(
        Array.from({ length: size }, (_, index) => [`field${index}`, "Invalid"]),
      )
      const issueSamples: number[] = []
      for (let sample = 0; sample < 15; sample += 1) {
        const started = performance.now()
        controller.setErrors(externalErrors)
        issueSamples.push(performance.now() - started)
        controller.setErrors({})
      }
      measurements.push(record("index and publish field issues", size, issueSamples))
      sink = controller.values.value
      if (typeof sink === "symbol") throw new Error("Unexpected benchmark sink")
      controller.dispose()
      form.remove()
    }
    return measurements
  }, new URL("/packages/form/dist/index.js", server.url).href)

  terminal.heading("Lithekit Form browser benchmarks")
  terminal.detail("browser", "Chromium · headless")
  terminal.table(results, [
    { header: "scenario", value: (row) => row.scenario },
    { align: "right", header: "controls", value: (row) => row.size.toLocaleString("en-US") },
    {
      align: "right",
      header: "median",
      value: (row) => `${row.medianMilliseconds.toFixed(3)} ms`,
    },
    {
      align: "right",
      header: "p95",
      value: (row) => `${row.p95Milliseconds.toFixed(3)} ms`,
    },
  ])
  terminal.success(`${results.length} browser benchmark cases completed`)
} finally {
  await browser.close()
  server.stop(true)
}
