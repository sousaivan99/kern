export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>
}

export declare namespace StandardSchemaV1 {
  interface Props<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>
    readonly types?: Types<Input, Output> | undefined
  }

  interface Types<Input = unknown, Output = Input> {
    readonly input: Input
    readonly output: Output
  }

  type Result<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | {
        readonly issues: readonly Issue[]
      }

  interface Issue {
    readonly message: string
    readonly path?: readonly (PropertyKey | PathSegment)[] | undefined
  }

  interface PathSegment {
    readonly key: PropertyKey
  }

  type InferInput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["input"]
  type InferOutput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["output"]
}

type AtomicDraft = Blob | Date | File | ((...args: never[]) => unknown)

export type FormDraft<T> = T extends AtomicDraft
  ? T
  : T extends readonly (infer Item)[]
    ? FormDraft<Item>[]
    : T extends object
      ? { [Key in keyof T]?: FormDraft<T[Key]> }
      : T

export interface ReadonlyFormSignal<T> {
  readonly value: T
  subscribe(listener: (value: T) => void): () => void
}

export type FormIssueSource = "configuration" | "external" | "schema"

export interface FormIssue {
  readonly message: string
  readonly name: string
  readonly original?: StandardSchemaV1.Issue | undefined
  readonly path?: readonly (string | number)[] | undefined
  readonly source: FormIssueSource
}

export type FormValidationResult<Output> =
  | { readonly status: "valid"; readonly output: Output }
  | { readonly status: "invalid"; readonly issues: readonly FormIssue[] }
  | { readonly status: "stale" }

export type ValidateOn = "input" | "progressive" | "submit"

export interface CreateFormOptions<Schema extends StandardSchemaV1<object, unknown>> {
  readonly focusInvalid?: boolean | undefined
  readonly initialValues?: FormDraft<StandardSchemaV1.InferInput<Schema>> | undefined
  readonly schema: Schema
  readonly validateOn?: ValidateOn | undefined
}

export interface FormFieldController {
  readonly dirty: ReadonlyFormSignal<boolean>
  readonly error: ReadonlyFormSignal<string | undefined>
  readonly invalid: ReadonlyFormSignal<boolean>
  readonly issues: ReadonlyFormSignal<readonly FormIssue[]>
  readonly touched: ReadonlyFormSignal<boolean>
  readonly validating: ReadonlyFormSignal<boolean>
  readonly value: ReadonlyFormSignal<unknown>
  setTouched(touched?: boolean): void
  setValue(value: unknown, options?: { readonly validate?: boolean | undefined }): void
}

export interface FormSubmitContext<Input extends object, Output> {
  readonly controller: FormController<Input, Output>
  readonly event: SubmitEvent
  readonly form: HTMLFormElement
  readonly values: FormDraft<Input>
}

export type FormValidHandler<Input extends object, Output> = (
  output: Output,
  context: FormSubmitContext<Input, Output>,
) => unknown | Promise<unknown>

export type FormInvalidHandler<Input extends object, Output> = (
  issues: readonly FormIssue[],
  context: FormSubmitContext<Input, Output>,
) => unknown | Promise<unknown>

export interface FormController<Input extends object, Output> {
  readonly dirty: ReadonlyFormSignal<boolean>
  readonly errors: ReadonlyFormSignal<Readonly<Record<string, string>>>
  readonly issues: ReadonlyFormSignal<readonly FormIssue[]>
  readonly output: ReadonlyFormSignal<Output | undefined>
  readonly submitCount: ReadonlyFormSignal<number>
  readonly submitting: ReadonlyFormSignal<boolean>
  readonly touched: ReadonlyFormSignal<boolean>
  readonly valid: ReadonlyFormSignal<boolean>
  readonly validated: ReadonlyFormSignal<boolean>
  readonly validating: ReadonlyFormSignal<boolean>
  readonly values: ReadonlyFormSignal<FormDraft<Input>>
  attach(form: HTMLFormElement | null): void
  dispose(): void
  field(name: string): FormFieldController
  handleSubmit(
    onValid: FormValidHandler<Input, Output>,
    onInvalid?: FormInvalidHandler<Input, Output> | undefined,
  ): (event: SubmitEvent) => Promise<void>
  reset(values?: FormDraft<Input> | undefined): void
  setErrors(errors: Readonly<Record<string, string | readonly string[] | undefined>>): void
  setFieldError(name: string, message?: string | undefined): void
  setTouched(name: string, touched?: boolean): void
  setValue(
    name: string,
    value: unknown,
    options?: { readonly validate?: boolean | undefined },
  ): void
  validate(): Promise<FormValidationResult<Output>>
}
