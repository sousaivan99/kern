import { createAccessibility } from "./accessibility.js"
import {
  type ControlDiscovery,
  controlGroups,
  type FieldGroup,
  type NativeControl,
  readControls,
  readGroup,
  writeGroup,
} from "./controls.js"
import {
  canonicalPath,
  getPath,
  hasPath,
  immutable,
  issuePath,
  parsePath,
  replacePath,
  structurallyEqual,
} from "./path.js"
import { type FormSignal, signal } from "./signal.js"
import type {
  CreateFormOptions,
  FormController,
  FormDraft,
  FormFieldController,
  FormInvalidHandler,
  FormIssue,
  FormSubmitContext,
  FormValidationResult,
  FormValidHandler,
  StandardSchemaV1,
} from "./types.js"

interface ValidationJob<Output> {
  readonly promise: Promise<FormValidationResult<Output>>
  readonly reject: (reason?: unknown) => void
  readonly resolve: (result: FormValidationResult<Output>) => void
  readonly revision: number
  readonly values: object
}

interface InternalField {
  readonly controller: FormFieldController
  readonly dirty: FormSignal<boolean>
  readonly error: FormSignal<string | undefined>
  readonly invalid: FormSignal<boolean>
  readonly issues: FormSignal<readonly FormIssue[]>
  readonly name: string
  readonly path: readonly (string | number)[]
  readonly touched: FormSignal<boolean>
  readonly validating: FormSignal<boolean>
  readonly value: FormSignal<unknown>
}

const emptyRecord = <Value>(): Record<string, Value> => Object.create(null)
const emptyIssues: readonly FormIssue[] = Object.freeze([])

const stableIssues = (
  current: readonly FormIssue[],
  next: readonly FormIssue[],
): readonly FormIssue[] =>
  current.length === next.length && current.every((issue, index) => issue === next[index])
    ? current
    : Object.freeze(next)

const reportAsyncError = (error: unknown): void => {
  if (typeof globalThis.reportError === "function") globalThis.reportError(error)
  else
    queueMicrotask(() => {
      throw error
    })
}

export const createFormController = <Schema extends StandardSchemaV1<object, unknown>>(
  options: CreateFormOptions<Schema>,
): FormController<StandardSchemaV1.InferInput<Schema>, StandardSchemaV1.InferOutput<Schema>> => {
  type Input = StandardSchemaV1.InferInput<Schema>
  type Output = StandardSchemaV1.InferOutput<Schema>
  type Controller = FormController<Input, Output>

  if (!["input", "progressive", "submit"].includes(options.validateOn ?? "progressive")) {
    throw new TypeError("validateOn must be input, progressive, or submit")
  }

  const values = signal<FormDraft<Input>>(immutable(Object.create(null)) as FormDraft<Input>)
  const output = signal<Output | undefined>(undefined)
  const errors = signal<Readonly<Record<string, string>>>(Object.freeze(emptyRecord<string>()))
  const issues = signal<readonly FormIssue[]>(Object.freeze([]))
  const valid = signal(true)
  const validated = signal(false)
  const validating = signal(false)
  const submitting = signal(false)
  const dirty = signal(false)
  const touched = signal(false)
  const submitCount = signal(0)
  const fields = new Map<string, InternalField>()
  const baselineFields = new Map<string, unknown>()
  const latestFields = new Map<string, unknown>()
  const currentFields = new Set<string>()
  const dirtyFields = new Set<string>()
  const touchedFields = new Set<string>()
  const observedControls = new WeakSet<NativeControl>()
  const controlNames = new WeakMap<
    NativeControl,
    { readonly name: string; readonly rawName: string }
  >()
  const accessibility = createAccessibility()
  let schemaIssues: readonly FormIssue[] = emptyIssues
  let configurationIssues: readonly FormIssue[] = emptyIssues
  let externalIssues: readonly FormIssue[] = emptyIssues
  let renderedSchemaIssues: readonly FormIssue[] = emptyIssues
  let renderedConfigurationIssues: readonly FormIssue[] = emptyIssues
  let renderedExternalIssues: readonly FormIssue[] = emptyIssues
  let issuesByName = new Map<string, readonly FormIssue[]>()
  let currentGroups: ReadonlyMap<string, FieldGroup> = new Map()
  let initialSeed: unknown = options.initialValues
  let attached: HTMLFormElement | null = null
  let observer: MutationObserver | undefined
  let originalNoValidate = false
  let revision = 0
  let disposed = false
  let activeJob: ValidationJob<Output> | undefined
  let queuedJob: ValidationJob<Output> | undefined
  let processing = false

  const assertActive = (): void => {
    if (disposed) throw new Error("This Lithekit form controller has been disposed")
  }

  const updateField = (field: InternalField): void => {
    const fieldIssues = issuesByName.get(field.name) ?? emptyIssues
    field.issues.set(stableIssues(field.issues.value, fieldIssues))
    field.error.set(fieldIssues[0]?.message)
    field.invalid.set(fieldIssues.length > 0)
    field.value.set(
      currentFields.has(field.name)
        ? getPath(values.value, field.path)
        : latestFields.get(field.name),
    )
    field.touched.set(touchedFields.has(field.name))
    field.dirty.set(
      latestFields.has(field.name) &&
        !structurallyEqual(latestFields.get(field.name), baselineFields.get(field.name)),
    )
    field.validating.set(validating.value)
  }

  const updateFields = (names?: readonly string[]): void => {
    if (names) {
      for (const name of names) {
        const field = fields.get(name)
        if (field) updateField(field)
      }
      return
    }
    for (const field of fields.values()) updateField(field)
  }

  const syncIssues = (): boolean => {
    if (
      configurationIssues === renderedConfigurationIssues &&
      schemaIssues === renderedSchemaIssues &&
      externalIssues === renderedExternalIssues
    ) {
      return false
    }
    const nextIssues = Object.freeze([...configurationIssues, ...schemaIssues, ...externalIssues])
    const nextErrors = emptyRecord<string>()
    const nextIssuesByName = new Map<string, FormIssue[]>()
    for (const issue of nextIssues) {
      const grouped = nextIssuesByName.get(issue.name)
      if (grouped) grouped.push(issue)
      else nextIssuesByName.set(issue.name, [issue])
      if (!Object.hasOwn(nextErrors, issue.name)) nextErrors[issue.name] = issue.message
    }
    issuesByName = nextIssuesByName
    renderedConfigurationIssues = configurationIssues
    renderedSchemaIssues = schemaIssues
    renderedExternalIssues = externalIssues
    issues.set(nextIssues)
    errors.set(Object.freeze(nextErrors))
    valid.set(nextIssues.length === 0)
    return true
  }

  const renderState = (fieldNames?: readonly string[], forceAccessibility = false): void => {
    const issuesChanged = syncIssues()
    dirty.set(dirtyFields.size > 0)
    touched.set(touchedFields.size > 0)
    if (issuesChanged || fieldNames === undefined) updateFields()
    else updateFields(fieldNames)
    if (attached && (issuesChanged || forceAccessibility)) {
      accessibility.update(attached, currentGroups, errors.value)
    }
  }

  validating.subscribe(() => updateFields())

  const cancelQueued = (): void => {
    if (!queuedJob) return
    queuedJob.resolve({ status: "stale" })
    queuedJob = undefined
  }

  const sameGroups = (
    left: ReadonlyMap<string, FieldGroup>,
    right: ReadonlyMap<string, FieldGroup>,
  ): boolean => {
    if (left.size !== right.size) return false
    for (const [name, group] of left) {
      const next = right.get(name)
      if (
        !next ||
        next.controls.length !== group.controls.length ||
        next.controls.some((control, index) => control !== group.controls[index])
      ) {
        return false
      }
    }
    return true
  }

  const rememberGroups = (discovered: ControlDiscovery): boolean => {
    const changed = !sameGroups(currentGroups, discovered.groups)
    currentGroups = discovered.groups
    for (const group of currentGroups.values()) {
      for (const control of group.controls) {
        controlNames.set(control, { name: group.name, rawName: control.name })
      }
    }
    return changed
  }

  const prepareNewControls = (groups: ReadonlyMap<string, FieldGroup>): void => {
    for (const group of groups.values()) {
      if (group.controls.every((control) => observedControls.has(control))) continue
      const stored = latestFields.has(group.name)
        ? latestFields.get(group.name)
        : hasPath(initialSeed, group.path)
          ? getPath(initialSeed, group.path)
          : undefined
      if (latestFields.has(group.name) || hasPath(initialSeed, group.path))
        writeGroup(group, stored)
      for (const control of group.controls) observedControls.add(control)
    }
  }

  const clearExternalField = (name: string): boolean => {
    if (!externalIssues.some((issue) => issue.name === name)) return false
    const next = externalIssues.filter((issue) => issue.name !== name)
    externalIssues = next.length === 0 ? emptyIssues : next
    return true
  }

  const refreshDirtyFields = (): void => {
    dirtyFields.clear()
    for (const name of currentFields) {
      if (
        baselineFields.has(name) &&
        !structurallyEqual(latestFields.get(name), baselineFields.get(name))
      ) {
        dirtyFields.add(name)
      }
    }
  }

  const reconcile = (
    editedName?: string,
    establishBaseline = false,
    discovered?: ControlDiscovery,
    forceAccessibility = false,
  ): boolean => {
    if (!attached) return false
    const nextDiscovery = discovered ?? controlGroups(attached)
    const groupsChanged = rememberGroups(nextDiscovery)
    prepareNewControls(nextDiscovery.groups)
    const snapshot = readControls(nextDiscovery)
    configurationIssues = snapshot.issues.length === 0 ? emptyIssues : snapshot.issues
    if (editedName) clearExternalField(editedName)
    const changed = !structurallyEqual(values.value, snapshot.values)
    currentFields.clear()
    for (const [name, value] of snapshot.fields) {
      currentFields.add(name)
      latestFields.set(name, value)
    }
    if (establishBaseline) {
      baselineFields.clear()
      for (const [name, value] of snapshot.fields) baselineFields.set(name, value)
    } else {
      for (const [name, value] of snapshot.fields) {
        if (!baselineFields.has(name)) baselineFields.set(name, value)
      }
    }
    refreshDirtyFields()
    if (changed) {
      revision += 1
      cancelQueued()
      output.set(undefined)
      values.set(snapshot.values as FormDraft<Input>)
    }
    renderState(undefined, groupsChanged || forceAccessibility)
    return changed
  }

  const reconcileField = (control: NativeControl, name: string): boolean => {
    const group = currentGroups.get(name)
    if (!group?.controls.includes(control)) return reconcile(name)
    const decoded = readGroup(group)
    if (decoded.issue) return reconcile(name)
    const clearedExternal = clearExternalField(name)
    const previous = latestFields.get(name)
    if (structurallyEqual(previous, decoded.value)) {
      if (clearedExternal) renderState()
      return false
    }
    latestFields.set(name, decoded.value)
    if (baselineFields.has(name) && !structurallyEqual(decoded.value, baselineFields.get(name))) {
      dirtyFields.add(name)
    } else dirtyFields.delete(name)
    revision += 1
    cancelQueued()
    output.set(undefined)
    values.set(replacePath(values.value, group.path, decoded.value))
    renderState([name])
    return true
  }

  const mapSchemaIssues = (input: readonly StandardSchemaV1.Issue[]): readonly FormIssue[] =>
    input.map((original) => {
      const path = issuePath(original.path)
      const unmappable = original.path !== undefined && path === undefined
      return {
        message: unmappable ? "Schema returned an unmappable issue path" : original.message,
        name: path && path.length > 0 ? canonicalPath(path) : "$form",
        original,
        path,
        source: unmappable ? "configuration" : "schema",
      }
    })

  const runJobs = async (): Promise<void> => {
    if (processing) return
    processing = true
    validating.set(true)
    try {
      while (queuedJob) {
        const job = queuedJob
        queuedJob = undefined
        activeJob = job
        try {
          const result = await options.schema["~standard"].validate(job.values)
          if (disposed || job.revision !== revision) {
            job.resolve({ status: "stale" })
            continue
          }
          validated.set(true)
          if (result.issues) {
            schemaIssues = mapSchemaIssues(result.issues)
            output.set(undefined)
            renderState()
            job.resolve({ status: "invalid", issues: issues.value })
          } else {
            const clearedSchemaIssues = schemaIssues.length > 0
            schemaIssues = emptyIssues
            renderState(clearedSchemaIssues ? undefined : [])
            if (issues.value.length > 0) {
              output.set(undefined)
              job.resolve({ status: "invalid", issues: issues.value })
            } else {
              output.set(result.value)
              job.resolve({ status: "valid", output: result.value })
            }
          }
        } catch (error) {
          if (job.revision === revision) output.set(undefined)
          job.reject(error)
        } finally {
          activeJob = undefined
        }
      }
    } finally {
      processing = false
      validating.set(false)
    }
  }

  const requestValidation = (reconcileFirst = true): Promise<FormValidationResult<Output>> => {
    assertActive()
    if (reconcileFirst) reconcile()
    if (activeJob?.revision === revision) return activeJob.promise
    if (queuedJob?.revision === revision) return queuedJob.promise
    if (queuedJob) queuedJob.resolve({ status: "stale" })
    let resolveJob!: (result: FormValidationResult<Output>) => void
    let rejectJob!: (reason?: unknown) => void
    const promise = new Promise<FormValidationResult<Output>>((resolve, reject) => {
      resolveJob = resolve
      rejectJob = reject
    })
    queuedJob = {
      promise,
      reject: rejectJob,
      resolve: resolveJob,
      revision,
      values: values.value,
    }
    void runJobs()
    return promise
  }

  const autoValidate = (): void => {
    void requestValidation(false).catch(reportAsyncError)
  }

  const eventControl = (event: Event): NativeControl | undefined => {
    if (!attached || typeof event.target !== "object" || event.target === null) return undefined
    const target = event.target as Partial<NativeControl>
    if (target.form !== attached || typeof target.name !== "string") return undefined
    return target as NativeControl
  }

  const fieldName = (control: NativeControl): string | undefined => {
    const known = controlNames.get(control)
    if (known?.rawName === control.name) return known.name
    try {
      return canonicalPath(parsePath(control.name))
    } catch {
      return undefined
    }
  }

  const onInput = (event: Event): void => {
    const control = eventControl(event)
    if (!control) return
    const name = fieldName(control)
    const changed = name ? reconcileField(control, name) : reconcile()
    if (!changed) return
    const mode = options.validateOn ?? "progressive"
    if (
      mode === "input" ||
      (mode === "progressive" && (errors.value[name ?? ""] || submitCount.value > 0))
    ) {
      autoValidate()
    }
  }

  const onChange = (event: Event): void => {
    const control = eventControl(event)
    if (!control) return
    const name = fieldName(control)
    if (name) reconcileField(control, name)
    else reconcile()
    if ((options.validateOn ?? "progressive") !== "submit") autoValidate()
  }

  const onFocusOut = (event: Event): void => {
    const control = eventControl(event)
    if (!control) return
    const name = fieldName(control)
    if (!name) return
    const newlyTouched = !touchedFields.has(name)
    touchedFields.add(name)
    const changed = reconcileField(control, name)
    if (newlyTouched && !changed) renderState([name])
    if ((options.validateOn ?? "progressive") === "progressive") autoValidate()
  }

  const relevantMutation = (records: readonly MutationRecord[]): boolean =>
    records.some((record) => {
      if (record.type === "attributes") return true
      return [...record.addedNodes, ...record.removedNodes].some(
        (node) =>
          node.nodeType === 1 &&
          ((node as Element).matches(
            "input, select, textarea, [data-error-for], [data-form-error]",
          ) ||
            (node as Element).querySelector(
              "input, select, textarea, [data-error-for], [data-form-error]",
            )),
      )
    })

  const detach = (): void => {
    if (!attached) return
    const document = attached.ownerDocument
    document.removeEventListener("input", onInput, true)
    document.removeEventListener("change", onChange, true)
    document.removeEventListener("focusout", onFocusOut, true)
    observer?.disconnect()
    observer = undefined
    attached.noValidate = originalNoValidate
    accessibility.cleanup()
    attached = null
    currentGroups = new Map()
  }

  const controller: Controller = {
    dirty,
    errors,
    issues,
    output,
    submitCount,
    submitting,
    touched,
    valid,
    validated,
    validating,
    values,
    attach(form) {
      assertActive()
      if (form === attached) return
      detach()
      if (!form) return
      attached = form
      originalNoValidate = form.noValidate
      form.noValidate = true
      const document = form.ownerDocument
      document.addEventListener("input", onInput, true)
      document.addEventListener("change", onChange, true)
      document.addEventListener("focusout", onFocusOut, true)
      reconcile(undefined, true, controlGroups(form), true)
      const Observer = document.defaultView?.MutationObserver
      if (Observer) {
        observer = new Observer((records) => {
          if (relevantMutation(records)) reconcile(undefined, false, undefined, true)
        })
        observer.observe(document.documentElement, {
          attributeFilter: [
            "data-error-for",
            "data-form-error",
            "disabled",
            "form",
            "multiple",
            "name",
            "type",
          ],
          attributes: true,
          childList: true,
          subtree: true,
        })
      }
    },
    dispose() {
      if (disposed) return
      revision += 1
      cancelQueued()
      detach()
      disposed = true
    },
    field(rawName) {
      assertActive()
      const path = parsePath(rawName)
      const name = canonicalPath(path)
      const existing = fields.get(name)
      if (existing) return existing.controller
      const fieldValue = signal(getPath(values.value, path))
      const fieldError = signal<string | undefined>(errors.value[name])
      const fieldIssues = signal<readonly FormIssue[]>(Object.freeze([]))
      const fieldInvalid = signal(false)
      const fieldTouched = signal(touchedFields.has(name))
      const fieldDirty = signal(false)
      const fieldValidating = signal(validating.value)
      const fieldController: FormFieldController = {
        dirty: fieldDirty,
        error: fieldError,
        invalid: fieldInvalid,
        issues: fieldIssues,
        touched: fieldTouched,
        validating: fieldValidating,
        value: fieldValue,
        setTouched: (next = true) => controller.setTouched(name, next),
        setValue: (next, fieldOptions) => controller.setValue(name, next, fieldOptions),
      }
      const internal: InternalField = {
        controller: fieldController,
        dirty: fieldDirty,
        error: fieldError,
        invalid: fieldInvalid,
        issues: fieldIssues,
        name,
        path,
        touched: fieldTouched,
        validating: fieldValidating,
        value: fieldValue,
      }
      fields.set(name, internal)
      updateField(internal)
      return fieldController
    },
    handleSubmit(
      onValid: FormValidHandler<Input, Output>,
      onInvalid?: FormInvalidHandler<Input, Output>,
    ) {
      return async (event: SubmitEvent): Promise<void> => {
        event.preventDefault()
        if (submitting.value || disposed || !attached) return
        submitting.set(true)
        submitCount.set(submitCount.value + 1)
        reconcile()
        const form = attached
        const context: FormSubmitContext<Input, Output> = {
          controller,
          event,
          form,
          values: values.value,
        }
        try {
          const result = await requestValidation(false)
          if (result.status === "stale") return
          if (result.status === "valid") await onValid(result.output, context)
          else {
            if (options.focusInvalid !== false) {
              const first = result.issues.find((issue) => issue.name !== "$form")
              const group = first ? currentGroups.get(first.name) : undefined
              group?.controls.find((control) => !control.disabled)?.focus()
            }
            await onInvalid?.(result.issues, context)
          }
        } finally {
          submitting.set(false)
        }
      }
    },
    reset(nextValues) {
      assertActive()
      revision += 1
      cancelQueued()
      schemaIssues = emptyIssues
      configurationIssues = emptyIssues
      externalIssues = emptyIssues
      touchedFields.clear()
      validated.set(false)
      submitCount.set(0)
      output.set(undefined)
      if (nextValues !== undefined) initialSeed = nextValues
      for (const name of latestFields.keys()) {
        const path = parsePath(name)
        const next =
          nextValues === undefined
            ? baselineFields.get(name)
            : hasPath(nextValues, path)
              ? getPath(nextValues, path)
              : undefined
        latestFields.set(name, next)
        baselineFields.set(name, next)
      }
      if (attached) {
        const discovered = controlGroups(attached)
        rememberGroups(discovered)
        prepareNewControls(discovered.groups)
        for (const group of discovered.groups.values()) {
          const next =
            nextValues !== undefined
              ? hasPath(nextValues, group.path)
                ? getPath(nextValues, group.path)
                : undefined
              : baselineFields.get(group.name)
          if (nextValues === undefined || hasPath(nextValues, group.path)) writeGroup(group, next)
        }
        reconcile(undefined, true, discovered)
      } else {
        dirtyFields.clear()
        renderState()
      }
    },
    setErrors(nextErrors) {
      assertActive()
      const next: FormIssue[] = []
      for (const [rawName, messages] of Object.entries(nextErrors)) {
        if (messages === undefined) continue
        const name = rawName === "$form" ? "$form" : canonicalPath(parsePath(rawName))
        const path = name === "$form" ? undefined : parsePath(name)
        for (const message of typeof messages === "string" ? [messages] : messages) {
          next.push({ message, name, path, source: "external" })
        }
      }
      externalIssues = next.length === 0 ? emptyIssues : next
      output.set(undefined)
      renderState()
    },
    setFieldError(rawName, message) {
      assertActive()
      const name = rawName === "$form" ? "$form" : canonicalPath(parsePath(rawName))
      const retained = externalIssues.filter((issue) => issue.name !== name)
      if (message !== undefined) {
        externalIssues = [
          ...retained,
          {
            message,
            name,
            path: name === "$form" ? undefined : parsePath(name),
            source: "external",
          },
        ]
      } else externalIssues = retained.length === 0 ? emptyIssues : retained
      output.set(undefined)
      renderState()
    },
    setTouched(rawName, next = true) {
      assertActive()
      const name = canonicalPath(parsePath(rawName))
      if (next) touchedFields.add(name)
      else touchedFields.delete(name)
      renderState([name])
    },
    setValue(rawName, next, setOptions) {
      assertActive()
      if (!attached) throw new Error("Attach the form before setting a field value")
      const name = canonicalPath(parsePath(rawName))
      const discovered = controlGroups(attached)
      rememberGroups(discovered)
      prepareNewControls(discovered.groups)
      const group = discovered.groups.get(name)
      if (!group) throw new RangeError(`No supported control named ${name}`)
      writeGroup(group, next)
      const control = group.controls[0]
      if (control) reconcileField(control, name)
      if (setOptions?.validate) autoValidate()
    },
    validate: () => requestValidation(),
  }

  return controller
}
