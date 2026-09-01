import {
  type CreateFormOptions,
  createForm,
  type FormController,
  type FormDraft,
  type FormFieldController,
  type FormInvalidHandler,
  type FormIssue,
  type FormValidHandler,
  type StandardSchemaV1,
} from "@lithekit/form"
import {
  type InjectionKey,
  inject,
  type MaybeRefOrGetter,
  onScopeDispose,
  provide,
  type Ref,
  readonly,
  type ShallowRef,
  shallowRef,
  toValue,
  watch,
} from "vue"

type CoreController = FormController<object, unknown>
const formKey: InjectionKey<CoreController> = Symbol("lithekit-form")

const vueSignal = <Value>(formSignal: {
  readonly value: Value
  subscribe(listener: (value: Value) => void): () => void
}): Readonly<ShallowRef<Value>> => {
  const value = shallowRef(formSignal.value) as ShallowRef<Value>
  const unsubscribe = formSignal.subscribe((next) => {
    value.value = next
  })
  onScopeDispose(unsubscribe)
  return readonly(value) as Readonly<ShallowRef<Value>>
}

export interface VueForm<Input extends object, Output> {
  readonly controller: FormController<Input, Output>
  readonly dirty: Readonly<ShallowRef<boolean>>
  readonly errors: Readonly<ShallowRef<Readonly<Record<string, string>>>>
  readonly formRef: ShallowRef<HTMLFormElement | null>
  readonly issues: Readonly<ShallowRef<readonly FormIssue[]>>
  readonly output: Readonly<ShallowRef<Output | undefined>>
  readonly submitCount: Readonly<ShallowRef<number>>
  readonly submitting: Readonly<ShallowRef<boolean>>
  readonly touched: Readonly<ShallowRef<boolean>>
  readonly valid: Readonly<ShallowRef<boolean>>
  readonly validated: Readonly<ShallowRef<boolean>>
  readonly validating: Readonly<ShallowRef<boolean>>
  readonly values: Readonly<ShallowRef<FormDraft<Input>>>
  readonly handleSubmit: (
    onValid: FormValidHandler<Input, Output>,
    onInvalid?: FormInvalidHandler<Input, Output>,
  ) => (event: SubmitEvent) => Promise<void>
  readonly reset: FormController<Input, Output>["reset"]
  readonly setErrors: FormController<Input, Output>["setErrors"]
  readonly setFieldError: FormController<Input, Output>["setFieldError"]
  readonly setTouched: FormController<Input, Output>["setTouched"]
  readonly setValue: FormController<Input, Output>["setValue"]
  readonly validate: FormController<Input, Output>["validate"]
}

export const useForm = <Schema extends StandardSchemaV1<object, unknown>>(
  options: CreateFormOptions<Schema>,
): VueForm<StandardSchemaV1.InferInput<Schema>, StandardSchemaV1.InferOutput<Schema>> => {
  type Input = StandardSchemaV1.InferInput<Schema>
  type Output = StandardSchemaV1.InferOutput<Schema>
  const controller = createForm(options)
  provide(formKey, controller as unknown as CoreController)
  const formRef = shallowRef<HTMLFormElement | null>(null)
  watch(formRef, (form) => controller.attach(form), { flush: "post" })
  onScopeDispose(() => controller.dispose())
  return {
    controller,
    dirty: vueSignal(controller.dirty),
    errors: vueSignal(controller.errors),
    formRef,
    handleSubmit: controller.handleSubmit,
    issues: vueSignal(controller.issues),
    output: vueSignal(controller.output),
    reset: controller.reset,
    setErrors: controller.setErrors,
    setFieldError: controller.setFieldError,
    setTouched: controller.setTouched,
    setValue: controller.setValue,
    submitCount: vueSignal(controller.submitCount),
    submitting: vueSignal(controller.submitting),
    touched: vueSignal(controller.touched),
    valid: vueSignal(controller.valid),
    validate: controller.validate,
    validated: vueSignal(controller.validated),
    validating: vueSignal(controller.validating),
    values: vueSignal(controller.values) as Readonly<ShallowRef<FormDraft<Input>>>,
  } satisfies VueForm<Input, Output>
}

export interface VueField {
  readonly dirty: Readonly<Ref<boolean>>
  readonly error: Readonly<Ref<string | undefined>>
  readonly invalid: Readonly<Ref<boolean>>
  readonly issues: Readonly<ShallowRef<readonly FormIssue[]>>
  readonly touched: Readonly<Ref<boolean>>
  readonly validating: Readonly<Ref<boolean>>
  readonly value: Readonly<ShallowRef<unknown>>
  setTouched(touched?: boolean): void
  setValue(value: unknown, options?: { readonly validate?: boolean | undefined }): void
}

export const useField = (name: MaybeRefOrGetter<string>): VueField => {
  const controller = inject(formKey)
  if (!controller) throw new Error("useField() requires an ancestor Lithekit form")
  const value = shallowRef<unknown>()
  const error = shallowRef<string | undefined>()
  const fieldIssues = shallowRef<readonly FormIssue[]>(Object.freeze([]))
  const invalid = shallowRef(false)
  const fieldTouched = shallowRef(false)
  const fieldDirty = shallowRef(false)
  const fieldValidating = shallowRef(false)
  let current: FormFieldController | undefined
  let unsubscribers: Array<() => void> = []

  const unsubscribe = (): void => {
    for (const stop of unsubscribers) stop()
    unsubscribers = []
  }
  const stopWatching = watch(
    () => toValue(name),
    (nextName) => {
      unsubscribe()
      current = controller.field(nextName)
      value.value = current.value.value
      error.value = current.error.value
      fieldIssues.value = current.issues.value
      invalid.value = current.invalid.value
      fieldTouched.value = current.touched.value
      fieldDirty.value = current.dirty.value
      fieldValidating.value = current.validating.value
      unsubscribers = [
        current.value.subscribe((next) => {
          value.value = next
        }),
        current.error.subscribe((next) => {
          error.value = next
        }),
        current.issues.subscribe((next) => {
          fieldIssues.value = next
        }),
        current.invalid.subscribe((next) => {
          invalid.value = next
        }),
        current.touched.subscribe((next) => {
          fieldTouched.value = next
        }),
        current.dirty.subscribe((next) => {
          fieldDirty.value = next
        }),
        current.validating.subscribe((next) => {
          fieldValidating.value = next
        }),
      ]
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    stopWatching()
    unsubscribe()
  })
  return {
    dirty: readonly(fieldDirty),
    error: readonly(error),
    invalid: readonly(invalid),
    issues: readonly(fieldIssues),
    touched: readonly(fieldTouched),
    validating: readonly(fieldValidating),
    value: readonly(value),
    setTouched: (next = true) => current?.setTouched(next),
    setValue: (next, options) => current?.setValue(next, options),
  }
}

export type {
  CreateFormOptions,
  FormController,
  FormDraft,
  FormIssue,
  FormValidationResult,
  StandardSchemaV1,
} from "@lithekit/form"
