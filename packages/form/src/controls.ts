import {
  canonicalPath,
  createRoot,
  FormPathError,
  immutable,
  type Path,
  parsePath,
  setPath,
} from "./path.js"
import type { FormIssue } from "./types.js"

export type NativeControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

export interface FieldGroup {
  readonly controls: readonly NativeControl[]
  readonly name: string
  readonly path: Path
  readonly rawName: string
}

export interface ControlSnapshot {
  readonly fields: ReadonlyMap<string, unknown>
  readonly groups: ReadonlyMap<string, FieldGroup>
  readonly issues: readonly FormIssue[]
  readonly values: object
}

export interface ControlDiscovery {
  readonly groups: ReadonlyMap<string, FieldGroup>
  readonly issues: readonly FormIssue[]
}

const ignoredInputTypes = new Set(["button", "image", "reset", "submit"])

const nativeControl = (element: Element): element is NativeControl => {
  const tag = element.tagName
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA"
}

const supported = (element: Element): element is NativeControl => {
  if (!nativeControl(element) || element.disabled || element.name.length === 0) return false
  return element.tagName !== "INPUT" || !ignoredInputTypes.has((element as HTMLInputElement).type)
}

export const controlGroups = (form: HTMLFormElement): ControlDiscovery => {
  const grouped = new Map<string, FieldGroup>()
  const issues: FormIssue[] = []
  const ElementConstructor = form.ownerDocument.defaultView?.Element
  for (const element of form.elements) {
    if (!ElementConstructor || !(element instanceof ElementConstructor) || !supported(element))
      continue
    let path: Path
    try {
      path = parsePath(element.name)
    } catch (error) {
      issues.push({
        message: error instanceof Error ? error.message : "Invalid field name",
        name: "$form",
        source: "configuration",
      })
      continue
    }
    const name = canonicalPath(path)
    const existing = grouped.get(name)
    if (existing) (existing.controls as NativeControl[]).push(element)
    else grouped.set(name, { controls: [element], name, path, rawName: element.name })
  }
  return { groups: grouped, issues }
}

type Kind = "checkbox" | "file" | "number" | "ordinary" | "radio" | "select-multiple"

const kind = (control: NativeControl): Kind => {
  if (control.tagName === "SELECT" && (control as HTMLSelectElement).multiple)
    return "select-multiple"
  if (control.tagName !== "INPUT") return "ordinary"
  const type = (control as HTMLInputElement).type
  if (type === "checkbox" || type === "radio" || type === "file") return type
  if (type === "number" || type === "range") return "number"
  return "ordinary"
}

const decodeOne = (control: NativeControl, controlKind: Kind): unknown => {
  if (controlKind === "number") {
    const value = (control as HTMLInputElement).valueAsNumber
    return Number.isNaN(value) ? undefined : value
  }
  if (controlKind === "select-multiple") {
    return [...(control as HTMLSelectElement).selectedOptions].map((option) => option.value)
  }
  if (controlKind === "file") {
    const input = control as HTMLInputElement
    const files = input.files ? [...input.files] : []
    return input.multiple ? files : files[0]
  }
  return control.value
}

export const readGroup = (
  group: FieldGroup,
): { readonly issue?: FormIssue; readonly value?: unknown } => {
  const first = group.controls[0] as NativeControl
  const groupKind = kind(first)
  if (group.controls.some((control) => kind(control) !== groupKind)) {
    return {
      issue: {
        message: `Field ${group.name} mixes incompatible control types`,
        name: group.name,
        path: group.path,
        source: "configuration",
      },
    }
  }
  if (groupKind === "checkbox") {
    if (group.controls.length === 1)
      return { value: (group.controls[0] as HTMLInputElement).checked }
    return {
      value: group.controls
        .filter((control) => (control as HTMLInputElement).checked)
        .map((control) => control.value),
    }
  }
  if (groupKind === "radio") {
    return { value: group.controls.find((control) => (control as HTMLInputElement).checked)?.value }
  }
  if (groupKind === "file" && group.controls.length > 1) {
    return {
      issue: {
        message: `Field ${group.name} contains repeated file controls`,
        name: group.name,
        path: group.path,
        source: "configuration",
      },
    }
  }
  const decoded = group.controls.map((control) => decodeOne(control, groupKind))
  return { value: decoded.length === 1 ? decoded[0] : decoded }
}

export const readControls = (discovered: ControlDiscovery): ControlSnapshot => {
  const issues = [...discovered.issues]
  const fields = new Map<string, unknown>()
  const paths: Path[] = []
  for (const group of discovered.groups.values()) {
    const decoded = readGroup(group)
    if (decoded.issue) issues.push(decoded.issue)
    else {
      fields.set(group.name, decoded.value)
      paths.push(group.path)
    }
  }
  const root = createRoot(paths)
  for (const [name, value] of fields) {
    const path = discovered.groups.get(name)?.path
    if (!path) continue
    try {
      setPath(root, path, value)
    } catch (error) {
      issues.push({
        message: error instanceof FormPathError ? error.message : "Conflicting field paths",
        name: "$form",
        source: "configuration",
      })
    }
  }
  return { fields, groups: discovered.groups, issues, values: immutable(root) }
}

const stringValues = (value: unknown): readonly string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError("Grouped controls require a string array")
  }
  return value
}

export const writeGroup = (group: FieldGroup, value: unknown): void => {
  const groupKind = kind(group.controls[0] as NativeControl)
  if (group.controls.some((control) => kind(control) !== groupKind))
    throw new TypeError("Cannot write a mixed control group")
  if (groupKind === "checkbox") {
    if (group.controls.length === 1) {
      if (typeof value !== "boolean") throw new TypeError("A single checkbox requires a boolean")
      ;(group.controls[0] as HTMLInputElement).checked = value
      return
    }
    const selected = new Set(stringValues(value))
    for (const control of group.controls)
      (control as HTMLInputElement).checked = selected.has(control.value)
    return
  }
  if (groupKind === "radio") {
    if (value !== undefined && typeof value !== "string")
      throw new TypeError("A radio group requires a string or undefined")
    for (const control of group.controls)
      (control as HTMLInputElement).checked = control.value === value
    return
  }
  if (groupKind === "file") {
    const empty = value === undefined || (Array.isArray(value) && value.length === 0)
    if (!empty) throw new TypeError("File inputs can only be cleared programmatically")
    ;(group.controls[0] as HTMLInputElement).value = ""
    return
  }
  if (groupKind === "select-multiple") {
    const selected = new Set(stringValues(value))
    for (const option of (group.controls[0] as HTMLSelectElement).options) {
      option.selected = selected.has(option.value)
    }
    return
  }
  const values = group.controls.length === 1 ? [value] : [...stringValues(value)]
  if (values.length !== group.controls.length)
    throw new RangeError("Repeated field value count does not match its controls")
  for (let index = 0; index < group.controls.length; index += 1) {
    const control = group.controls[index] as NativeControl
    const next = values[index]
    if (groupKind === "number") {
      if (next === undefined) control.value = ""
      else if (typeof next === "number" && Number.isFinite(next)) control.value = String(next)
      else throw new TypeError("Numeric controls require finite numbers or undefined")
    } else {
      if (typeof next !== "string") throw new TypeError("Text controls require strings")
      control.value = next
    }
  }
}
