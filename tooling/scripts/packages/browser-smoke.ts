import { resolve, sep } from "node:path"
import { chromium, firefox, webkit } from "playwright"
import { terminal } from "../shared/console.js"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const browserName =
  process.argv.find((argument) => argument.startsWith("--browser="))?.slice(10) ?? "chromium"
const browserType = { chromium, firefox, webkit }[browserName as "chromium" | "firefox" | "webkit"]
if (!browserType) throw new Error(`Unsupported browser engine: ${browserName}`)

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/") {
      return new Response("<!doctype html><title>Lithekit Form smoke</title>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    const filePath = resolve(repositoryRoot, `.${decodeURIComponent(url.pathname)}`)
    if (filePath !== repositoryRoot && !filePath.startsWith(`${repositoryRoot}${sep}`)) {
      return new Response("Forbidden", { status: 403 })
    }
    const file = Bun.file(filePath)
    if (!(await file.exists())) return new Response("Not found", { status: 404 })
    return new Response(file, {
      headers: {
        "content-type": filePath.endsWith(".js") ? "text/javascript" : "application/octet-stream",
      },
    })
  },
})

const browser = await browserType.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(server.url.href)
  const result = await page.evaluate(async (moduleUrl) => {
    const { createForm } = await import(moduleUrl)
    document.body.innerHTML = `
      <form id="account">
        <span id="author-help">Author help</span>
        <input name="profile.email" value="before@example.com" aria-describedby="author-help" aria-invalid="grammar">
        <input name="age" type="number" value="17">
        <input name="enabled" type="checkbox" checked>
        <input name="roles" type="checkbox" value="admin" checked>
        <input name="roles" type="checkbox" value="editor">
        <span id="author-error" data-error-for="profile.email" aria-live="assertive">Author field text</span>
        <span data-error-for="profile.email">Generated field text</span>
        <div data-form-error aria-live="off">Author form text</div>
        <button>Save</button>
      </form>
      <input form="account" name="external" value="outside">
    `
    const schema = {
      "~standard": {
        version: 1,
        vendor: "browser-smoke",
        async validate(value: unknown) {
          await Promise.resolve()
          const input = value as { age?: number; profile?: { email?: string } }
          const issues: Array<{ message: string; path: Array<string> }> = []
          if (!input.profile?.email?.includes("@")) {
            issues.push({ message: "Invalid email", path: ["profile", "email"] })
          }
          if (typeof input.age !== "number" || input.age < 18) {
            issues.push({ message: "Must be an adult", path: ["age"] })
          }
          return issues.length > 0 ? { issues } : { value: { ...input, normalized: true } }
        },
      },
    }
    const formElement = document.querySelector<HTMLFormElement>("form")
    if (!formElement) return "missing-form"
    const controller = createForm({ schema, validateOn: "progressive" })
    controller.attach(formElement)
    const initial = controller.values.value
    if (initial.profile.email !== "before@example.com" || initial.age !== 17) return "decode"
    if (initial.enabled !== true || initial.roles[0] !== "admin" || initial.external !== "outside")
      return "groups"

    const invalid = await controller.validate()
    if (invalid.status !== "invalid" || controller.errors.value.age !== "Must be an adult")
      return "invalid"
    const age = formElement.elements.namedItem("age")
    if (!(age instanceof HTMLInputElement)) return "missing-age"
    if (age.getAttribute("aria-invalid") !== "true") return "aria-invalid"

    controller.setValue("age", 20)
    controller.setValue("profile.email", "after@example.com")
    const valid = await controller.validate()
    if (valid.status !== "valid" || valid.output.normalized !== true) return "valid"
    if (!controller.dirty.value) return "dirty"

    controller.setFieldError("profile.email", "Already used")
    const targets = [...document.querySelectorAll<HTMLElement>("[data-error-for]")]
    if (targets.length !== 2) return "missing-target"
    if (targets.some((target) => target.textContent !== "Already used" || target.hidden))
      return "external-error"
    const email = formElement.elements.namedItem("profile.email")
    if (!(email instanceof HTMLInputElement)) return "missing-email"
    const describedBy = email.getAttribute("aria-describedby")?.split(/\s+/)
    if (
      describedBy?.[0] !== "author-help" ||
      !describedBy.includes("author-error") ||
      targets.some((target) => !target.id || !describedBy.includes(target.id))
    )
      return "aria-describedby-ownership"
    if (targets[0]?.getAttribute("aria-live") !== "assertive") return "aria-live-author"
    if (targets[1]?.getAttribute("aria-live") !== "polite") return "aria-live-generated"
    controller.setFieldError("$form", "Request failed")
    const formTarget = document.querySelector<HTMLElement>("[data-form-error]")
    if (formTarget?.textContent !== "Request failed" || formTarget.hidden)
      return "form-error-target"
    email.value = "new@example.com"
    email.dispatchEvent(new InputEvent("input", { bubbles: true }))
    if (controller.errors.value["profile.email"] !== undefined) return "clear-server"
    if (controller.errors.value.$form !== "Request failed") return "persist-form-error"
    controller.setFieldError("$form")

    controller.reset()
    if (
      controller.dirty.value ||
      controller.submitCount.value !== 0 ||
      controller.values.value.age !== 17
    )
      return "reset"
    const oldNoValidate = formElement.noValidate
    controller.attach(null)
    if (
      formElement.noValidate === oldNoValidate ||
      age.hasAttribute("aria-invalid") ||
      email.getAttribute("aria-invalid") !== "grammar" ||
      email.getAttribute("aria-describedby") !== "author-help" ||
      targets[0]?.textContent !== "Author field text" ||
      targets[0]?.getAttribute("aria-live") !== "assertive" ||
      targets[1]?.textContent !== "Generated field text" ||
      targets[1]?.hasAttribute("id") ||
      targets[1]?.hasAttribute("aria-live") ||
      document.querySelector<HTMLElement>("[data-form-error]")?.textContent !==
        "Author form text" ||
      document.querySelector<HTMLElement>("[data-form-error]")?.getAttribute("aria-live") !== "off"
    )
      return "cleanup"
    controller.dispose()

    document.body.innerHTML = `
      <form id="decoders">
        <input name="plain" value="text">
        <textarea name="notes">details</textarea>
        <input name="date" type="date" value="2026-09-01">
        <input name="time" type="time" value="12:34">
        <input name="color" type="color" value="#123456">
        <input name="hidden" type="hidden" value="secret">
        <input name="count" type="number" value="">
        <input name="range" type="range" min="0" max="10" value="7">
        <input name="disabled" value="ignored" disabled>
        <input value="unnamed">
        <input name="ignoredSubmit" type="submit" value="ignored">
        <input name="ignoredReset" type="reset" value="ignored">
        <button name="ignoredButton" type="button">Ignored</button>
        <output name="ignoredOutput">Ignored</output>
        <input name="unchecked" type="checkbox">
        <input name="repeated" value="first"><input name="repeated" value="second">
        <input name="choice" type="radio" value="a"><input name="choice" type="radio" value="b" checked>
        <select name="single"><option value="one">One</option><option value="two" selected>Two</option></select>
        <select name="many" multiple><option value="a" selected>A</option><option value="b" selected>B</option></select>
        <input name="upload" type="file">
        <input name="uploads" type="file" multiple>
      </form>
    `
    const decoderForm = document.querySelector<HTMLFormElement>("#decoders")
    if (!decoderForm) return "missing-decoders"
    const passSchema = {
      "~standard": { version: 1, vendor: "pass", validate: (value: unknown) => ({ value }) },
    }
    const decoderController = createForm({ schema: passSchema })
    decoderController.attach(decoderForm)
    const decoded = decoderController.values.value
    if (
      decoded.plain !== "text" ||
      decoded.notes !== "details" ||
      decoded.date !== "2026-09-01" ||
      decoded.time !== "12:34" ||
      decoded.color !== "#123456" ||
      decoded.hidden !== "secret" ||
      decoded.count !== undefined ||
      decoded.range !== 7 ||
      decoded.unchecked !== false
    )
      return "text-number-decode"
    if (
      "disabled" in decoded ||
      "ignoredSubmit" in decoded ||
      "ignoredReset" in decoded ||
      "ignoredButton" in decoded ||
      "ignoredOutput" in decoded
    )
      return "ignored-controls"
    if (decoded.repeated.join(",") !== "first,second" || decoded.choice !== "b")
      return "repeated-radio-decode"
    if (
      decoded.single !== "two" ||
      decoded.many.join(",") !== "a,b" ||
      decoded.upload !== undefined ||
      decoded.uploads.length !== 0
    )
      return "select-file-decode"
    const upload = decoderForm.elements.namedItem("upload")
    const uploads = decoderForm.elements.namedItem("uploads")
    if (!(upload instanceof HTMLInputElement) || !(uploads instanceof HTMLInputElement))
      return "missing-files"
    const singleFile = new File(["single"], "single.txt", { type: "text/plain" })
    const multipleFiles = [
      new File(["first"], "first.txt", { type: "text/plain" }),
      new File(["second"], "second.txt", { type: "text/plain" }),
    ]
    const singleTransfer = new DataTransfer()
    singleTransfer.items.add(singleFile)
    upload.files = singleTransfer.files
    upload.dispatchEvent(new Event("change", { bubbles: true }))
    const multipleTransfer = new DataTransfer()
    for (const file of multipleFiles) multipleTransfer.items.add(file)
    uploads.files = multipleTransfer.files
    uploads.dispatchEvent(new Event("change", { bubbles: true }))
    if (
      decoderController.values.value.upload !== singleFile ||
      decoderController.values.value.uploads[0] !== multipleFiles[0] ||
      decoderController.values.value.uploads[1] !== multipleFiles[1]
    )
      return "selected-file-decode"
    decoderController.setValue("upload", undefined)
    decoderController.setValue("uploads", [])
    if (upload.files?.length !== 0 || uploads.files?.length !== 0) return "file-clear"
    let fileWriteRejected = false
    try {
      decoderController.setValue("upload", new File(["x"], "x.txt"))
    } catch {
      fileWriteRejected = true
    }
    if (!fileWriteRejected) return "file-write"

    const dormant = document.createElement("input")
    dormant.name = "dormant"
    dormant.value = "first"
    decoderForm.append(dormant)
    await new Promise((resolve) => setTimeout(resolve, 0))
    dormant.value = "committed"
    dormant.dispatchEvent(new InputEvent("input", { bubbles: true }))
    dormant.remove()
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (decoderController.values.value.dormant !== undefined) return "removed-current-value"
    decoderController.reset({ dormant: "reset-while-absent" })
    const returned = document.createElement("input")
    returned.name = "dormant"
    decoderForm.append(returned)
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (returned.value !== "reset-while-absent") return "retained-reset"
    decoderController.dispose()

    document.body.innerHTML =
      '<form id="mixed"><input name="same"><input name="same" type="checkbox"></form>'
    const mixedForm = document.querySelector<HTMLFormElement>("#mixed")
    if (!mixedForm) return "missing-mixed"
    const mixedController = createForm({ schema: passSchema })
    mixedController.attach(mixedForm)
    if (mixedController.issues.value[0]?.source !== "configuration") return "mixed-configuration"
    mixedController.dispose()

    document.body.innerHTML = '<form id="race"><input name="query" value="first"></form>'
    const raceForm = document.querySelector<HTMLFormElement>("#race")
    const raceInput = raceForm?.elements.namedItem("query")
    if (!raceForm || !(raceInput instanceof HTMLInputElement)) return "missing-race"
    const validationResolvers: Array<(result: { value: unknown }) => void> = []
    const validationResolverCount = (): number => validationResolvers.length
    const raceSchema = {
      "~standard": {
        version: 1,
        vendor: "race",
        validate: () =>
          new Promise<{ value: unknown }>((resolve) => validationResolvers.push(resolve)),
      },
    }
    const raceController = createForm({ schema: raceSchema, validateOn: "submit" })
    raceController.attach(raceForm)
    const firstValidation = raceController.validate()
    raceInput.value = "second"
    raceInput.dispatchEvent(new InputEvent("input", { bubbles: true }))
    const secondValidation = raceController.validate()
    if (validationResolverCount() !== 1) return "unbounded-validation"
    validationResolvers[0]?.({ value: { query: "first" } })
    if ((await firstValidation).status !== "stale") return "race-not-stale"
    await Promise.resolve()
    if (validationResolverCount() !== 2) return "missing-queued-validation"
    validationResolvers[1]?.({ value: { query: "second" } })
    if ((await secondValidation).status !== "valid") return "queued-validation"
    raceController.dispose()

    document.body.innerHTML = '<form id="submit-race"><input name="query" value="first"></form>'
    const submitForm = document.querySelector<HTMLFormElement>("#submit-race")
    const submitInput = submitForm?.elements.namedItem("query")
    if (!submitForm || !(submitInput instanceof HTMLInputElement)) return "missing-submit-race"
    let resolveSubmit: ((result: { value: unknown }) => void) | undefined
    const submitController = createForm({
      schema: {
        "~standard": {
          version: 1,
          vendor: "submit",
          validate: () =>
            new Promise<{ value: unknown }>((resolve) => {
              resolveSubmit = resolve
            }),
        },
      },
    })
    submitController.attach(submitForm)
    let validCalls = 0
    const submit = submitController.handleSubmit(() => {
      validCalls += 1
    })
    const pendingSubmit = submit(new SubmitEvent("submit", { cancelable: true }))
    await submit(new SubmitEvent("submit", { cancelable: true }))
    if (submitController.submitCount.value !== 1) return "concurrent-submit-count"
    submitInput.value = "changed"
    submitInput.dispatchEvent(new InputEvent("input", { bubbles: true }))
    resolveSubmit?.({ value: { query: "first" } })
    await pendingSubmit
    if (validCalls !== 0 || submitController.submitting.value) return "stale-submit"
    submitController.dispose()

    document.body.innerHTML = '<form id="focus"><input name="email"><button>Save</button></form>'
    const focusForm = document.querySelector<HTMLFormElement>("#focus")
    const focusInput = focusForm?.elements.namedItem("email")
    if (!focusForm || !(focusInput instanceof HTMLInputElement)) return "missing-focus"
    const focusController = createForm({
      schema: {
        "~standard": {
          version: 1,
          vendor: "focus",
          validate: () => ({ issues: [{ message: "Required", path: ["email"] }] }),
        },
      },
    })
    focusController.attach(focusForm)
    await focusController.handleSubmit(() => undefined)(
      new SubmitEvent("submit", { cancelable: true }),
    )
    if (document.activeElement !== focusInput) return "invalid-focus"
    focusController.dispose()

    document.body.innerHTML = `
      <form id="first-form"><input name="value" value="first"><span data-error-for="value">Original</span></form>
      <form id="second-form"><input name="value" value="second"></form>
    `
    const firstForm = document.querySelector<HTMLFormElement>("#first-form")
    const secondForm = document.querySelector<HTMLFormElement>("#second-form")
    const firstInput = firstForm?.elements.namedItem("value")
    const secondInput = secondForm?.elements.namedItem("value")
    if (
      !firstForm ||
      !secondForm ||
      !(firstInput instanceof HTMLInputElement) ||
      !(secondInput instanceof HTMLInputElement)
    )
      return "missing-lifecycle"
    let lifecycleValidations = 0
    const lifecycleController = createForm({
      schema: {
        "~standard": {
          version: 1,
          vendor: "lifecycle",
          validate: (value: unknown) => {
            lifecycleValidations += 1
            return { value }
          },
        },
      },
    })
    lifecycleController.attach(firstForm)
    lifecycleController.attach(firstForm)
    firstInput.dispatchEvent(new Event("change", { bubbles: true }))
    await lifecycleController.validate()
    if (lifecycleValidations !== 1) return "duplicate-attachment-listener"
    lifecycleController.setFieldError("value", "Invalid")
    lifecycleController.attach(secondForm)
    if (firstForm.noValidate || firstInput.hasAttribute("aria-invalid"))
      return "replacement-cleanup"
    const beforeDetachedEvent = lifecycleValidations
    const beforeDetachedValues = lifecycleController.values.value
    firstInput.value = "detached"
    firstInput.dispatchEvent(new Event("change", { bubbles: true }))
    await Promise.resolve()
    if (
      lifecycleValidations !== beforeDetachedEvent ||
      lifecycleController.values.value !== beforeDetachedValues
    )
      return "detached-listener"
    lifecycleController.attach(null)
    if (secondForm.noValidate) return "reusable-detach"
    lifecycleController.attach(secondForm)
    lifecycleController.dispose()
    lifecycleController.dispose()
    let disposedRejected = 0
    for (const action of [
      () => lifecycleController.attach(secondForm),
      () => lifecycleController.field("value"),
      () => lifecycleController.reset(),
      () => lifecycleController.validate(),
    ]) {
      try {
        await action()
      } catch {
        disposedRejected += 1
      }
    }
    if (disposedRejected !== 4 || secondForm.noValidate) return "dispose-final"

    document.body.innerHTML = '<form id="exceptions"><input name="value" value="ok"></form>'
    const exceptionForm = document.querySelector<HTMLFormElement>("#exceptions")
    if (!exceptionForm) return "missing-exceptions"
    const schemaError = new Error("schema exploded")
    const exceptionController = createForm({
      schema: {
        "~standard": {
          version: 1,
          vendor: "exceptions",
          validate: () => {
            throw schemaError
          },
        },
      },
    })
    exceptionController.attach(exceptionForm)
    let rejectedWithSchemaError = false
    try {
      await exceptionController.validate()
    } catch (error) {
      rejectedWithSchemaError = error === schemaError
    }
    if (!rejectedWithSchemaError || exceptionController.validating.value)
      return "schema-exception-finally"
    exceptionController.dispose()

    const callbackError = new Error("callback exploded")
    const callbackController = createForm({ schema: passSchema })
    callbackController.attach(exceptionForm)
    let rejectedWithCallbackError = false
    try {
      await callbackController.handleSubmit(() => {
        throw callbackError
      })(new SubmitEvent("submit", { cancelable: true }))
    } catch (error) {
      rejectedWithCallbackError = error === callbackError
    }
    if (!rejectedWithCallbackError || callbackController.submitting.value)
      return "callback-exception-finally"
    callbackController.dispose()
    return "ok"
  }, new URL("/packages/form/dist/index.js", server.url).href)
  if (result !== "ok") throw new Error(`Form browser smoke failed at ${result}`)
} finally {
  await browser.close()
  server.stop(true)
}

terminal.success(`${browserName} Form smoke test passed`)
