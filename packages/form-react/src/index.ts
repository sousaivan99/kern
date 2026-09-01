import {
  type CreateFormOptions,
  createForm,
  type FormController,
  type FormDraft,
  type FormInvalidHandler,
  type FormIssue,
  type FormValidHandler,
  type ReadonlyFormSignal,
  type StandardSchemaV1,
} from "@lithekit/form"
import {
  createContext,
  createElement,
  type FormEvent,
  type FormHTMLAttributes,
  forwardRef,
  type ReactElement,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"

const snapshot = <Value>(source: ReadonlyFormSignal<Value>): Value => source.value

const useSignal = <Value>(source: ReadonlyFormSignal<Value>): Value =>
  useSyncExternalStore(
    source.subscribe,
    () => snapshot(source),
    () => snapshot(source),
  )

export interface ReactForm<Input extends object, Output> {
  readonly controller: FormController<Input, Output>
  readonly dirty: boolean
  readonly errors: Readonly<Record<string, string>>
  readonly formRef: (form: HTMLFormElement | null) => void
  readonly handleSubmit: (
    onValid: FormValidHandler<Input, Output>,
    onInvalid?: FormInvalidHandler<Input, Output>,
  ) => (event: FormEvent<HTMLFormElement>) => Promise<void>
  readonly issues: readonly FormIssue[]
  readonly output: Output | undefined
  readonly reset: FormController<Input, Output>["reset"]
  readonly setErrors: FormController<Input, Output>["setErrors"]
  readonly setFieldError: FormController<Input, Output>["setFieldError"]
  readonly setTouched: FormController<Input, Output>["setTouched"]
  readonly setValue: FormController<Input, Output>["setValue"]
  readonly submitCount: number
  readonly submitting: boolean
  readonly touched: boolean
  readonly valid: boolean
  readonly validate: FormController<Input, Output>["validate"]
  readonly validated: boolean
  readonly validating: boolean
  readonly values: FormDraft<Input>
}

type UnknownController = FormController<object, unknown>
const FormContext = createContext<UnknownController | null>(null)

export const useForm = <Schema extends StandardSchemaV1<object, unknown>>(
  options: CreateFormOptions<Schema>,
): ReactForm<StandardSchemaV1.InferInput<Schema>, StandardSchemaV1.InferOutput<Schema>> => {
  type Input = StandardSchemaV1.InferInput<Schema>
  type Output = StandardSchemaV1.InferOutput<Schema>
  const controllerRef = useRef<FormController<Input, Output> | null>(null)
  if (!controllerRef.current) controllerRef.current = createForm(options)
  const controller = controllerRef.current
  const generation = useRef(0)
  useEffect(() => {
    const mountedGeneration = ++generation.current
    return () => {
      controller.attach(null)
      queueMicrotask(() => {
        if (generation.current === mountedGeneration) controller.dispose()
      })
    }
  }, [controller])
  const formRef = useCallback(
    (form: HTMLFormElement | null) => controller.attach(form),
    [controller],
  )
  const handleSubmit = useCallback(
    (onValid: FormValidHandler<Input, Output>, onInvalid?: FormInvalidHandler<Input, Output>) => {
      const handler = controller.handleSubmit(onValid, onInvalid)
      return (event: FormEvent<HTMLFormElement>): Promise<void> =>
        handler(event.nativeEvent as SubmitEvent)
    },
    [controller],
  )
  return {
    controller,
    dirty: useSignal(controller.dirty),
    errors: useSignal(controller.errors),
    formRef,
    handleSubmit,
    issues: useSignal(controller.issues),
    output: useSignal(controller.output),
    reset: controller.reset,
    setErrors: controller.setErrors,
    setFieldError: controller.setFieldError,
    setTouched: controller.setTouched,
    setValue: controller.setValue,
    submitCount: useSignal(controller.submitCount),
    submitting: useSignal(controller.submitting),
    touched: useSignal(controller.touched),
    valid: useSignal(controller.valid),
    validate: controller.validate,
    validated: useSignal(controller.validated),
    validating: useSignal(controller.validating),
    values: useSignal(controller.values),
  }
}

export interface FormProps<Input extends object, Output>
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "noValidate"> {
  readonly form: ReactForm<Input, Output>
}

const assignRef = (ref: Ref<HTMLFormElement> | undefined, value: HTMLFormElement | null): void => {
  if (typeof ref === "function") ref(value)
  else if (ref) ref.current = value
}

export const Form = forwardRef(function LithekitForm<Input extends object, Output>(
  { form, ...props }: FormProps<Input, Output>,
  forwardedRef: Ref<HTMLFormElement>,
): ReactElement {
  const elementRef = useRef<HTMLFormElement | null>(null)
  const forwardedRefState = useRef(forwardedRef)
  useEffect(() => {
    const previous = forwardedRefState.current
    if (previous === forwardedRef) return
    assignRef(previous, null)
    forwardedRefState.current = forwardedRef
    assignRef(forwardedRef, elementRef.current)
  }, [forwardedRef])
  const ref = useCallback(
    (element: HTMLFormElement | null): void => {
      elementRef.current = element
      form.formRef(element)
      assignRef(forwardedRefState.current, element)
    },
    [form.formRef],
  )
  return createElement(
    FormContext.Provider,
    { value: form.controller as unknown as UnknownController },
    createElement("form", { ...props, noValidate: true, ref }),
  )
}) as <Input extends object, Output>(
  props: FormProps<Input, Output> & { readonly ref?: Ref<HTMLFormElement> | undefined },
) => ReactElement

export interface ReactField {
  readonly dirty: boolean
  readonly error: string | undefined
  readonly invalid: boolean
  readonly issues: readonly FormIssue[]
  readonly setTouched: (touched?: boolean) => void
  readonly setValue: (value: unknown, options?: { readonly validate?: boolean | undefined }) => void
  readonly touched: boolean
  readonly validating: boolean
  readonly value: unknown
}

export const useField = (name: string): ReactField => {
  const controller = useContext(FormContext)
  if (!controller) throw new Error("useField() requires an ancestor Lithekit <Form>")
  const field = useMemo(() => controller.field(name), [controller, name])
  return {
    dirty: useSignal(field.dirty),
    error: useSignal(field.error),
    invalid: useSignal(field.invalid),
    issues: useSignal(field.issues),
    setTouched: useCallback((next = true) => field.setTouched(next), [field]),
    setValue: useCallback((value, options) => field.setValue(value, options), [field]),
    touched: useSignal(field.touched),
    validating: useSignal(field.validating),
    value: useSignal(field.value),
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
