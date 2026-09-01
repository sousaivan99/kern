import type { FieldGroup } from "./controls.js"
import { canonicalPath, parsePath } from "./path.js"

interface OriginalElementState {
  readonly ariaDescribedBy: string | null
  readonly ariaInvalid: string | null
}

interface OriginalTargetState {
  readonly ariaLive: string | null
  readonly hidden: HTMLElement["hidden"]
  readonly id: string | null
  readonly text: string | null
}

let generatedId = 0

const restoreAttribute = (element: Element, name: string, value: string | null): void => {
  if (value === null) element.removeAttribute(name)
  else element.setAttribute(name, value)
}

export const createAccessibility = () => {
  const controls = new Map<NativeControlElement, OriginalElementState>()
  const targets = new Map<HTMLElement, OriginalTargetState>()

  type NativeControlElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

  const rememberControl = (control: NativeControlElement): void => {
    if (controls.has(control)) return
    controls.set(control, {
      ariaDescribedBy: control.getAttribute("aria-describedby"),
      ariaInvalid: control.getAttribute("aria-invalid"),
    })
  }

  const rememberTarget = (target: HTMLElement): void => {
    if (targets.has(target)) return
    targets.set(target, {
      ariaLive: target.getAttribute("aria-live"),
      hidden: target.hidden,
      id: target.getAttribute("id"),
      text: target.textContent,
    })
  }

  const targetName = (target: HTMLElement): string | undefined => {
    if (target.hasAttribute("data-form-error")) return "$form"
    const raw = target.getAttribute("data-error-for")
    if (!raw) return undefined
    try {
      return canonicalPath(parsePath(raw))
    } catch {
      return undefined
    }
  }

  const update = (
    form: HTMLFormElement,
    groups: ReadonlyMap<string, FieldGroup>,
    errors: Readonly<Record<string, string>>,
  ): void => {
    const described = new Map<string, string[]>()
    for (const candidate of form.querySelectorAll<HTMLElement>(
      "[data-error-for], [data-form-error]",
    )) {
      const name = targetName(candidate)
      if (!name) continue
      rememberTarget(candidate)
      const message = errors[name]
      candidate.textContent = message ?? ""
      candidate.hidden = message === undefined
      if (!candidate.hasAttribute("aria-live")) candidate.setAttribute("aria-live", "polite")
      if (message !== undefined && name !== "$form") {
        if (!candidate.id) candidate.id = `lithekit-form-error-${++generatedId}`
        const ids = described.get(name) ?? []
        ids.push(candidate.id)
        described.set(name, ids)
      }
    }

    for (const [name, group] of groups) {
      const invalid = errors[name] !== undefined
      const ids = described.get(name) ?? []
      for (const control of group.controls) {
        rememberControl(control)
        const original = controls.get(control) as OriginalElementState
        if (invalid) control.setAttribute("aria-invalid", "true")
        else restoreAttribute(control, "aria-invalid", original.ariaInvalid)
        const authorTokens = original.ariaDescribedBy?.split(/\s+/u).filter(Boolean) ?? []
        const tokens = [...new Set([...authorTokens, ...ids])]
        if (tokens.length === 0) control.removeAttribute("aria-describedby")
        else control.setAttribute("aria-describedby", tokens.join(" "))
      }
    }
  }

  const cleanup = (): void => {
    for (const [control, original] of controls) {
      restoreAttribute(control, "aria-describedby", original.ariaDescribedBy)
      restoreAttribute(control, "aria-invalid", original.ariaInvalid)
    }
    for (const [target, original] of targets) {
      restoreAttribute(target, "aria-live", original.ariaLive)
      restoreAttribute(target, "id", original.id)
      target.hidden = original.hidden
      target.textContent = original.text
    }
    controls.clear()
    targets.clear()
  }

  return { cleanup, update }
}
