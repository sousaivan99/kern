export type PathSegment = string | number

export type ValueKind =
  | "array"
  | "bigint"
  | "boolean"
  | "date"
  | "function"
  | "nan"
  | "null"
  | "number"
  | "object"
  | "string"
  | "symbol"
  | "undefined"

export interface ValidationIssue {
  readonly path: readonly PathSegment[]
  readonly code: string
  readonly message: string
  readonly expected?: string
  readonly received?: ValueKind
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
}

export interface SafeParseSuccess<T> {
  readonly success: true
  readonly data: T
}

export interface SafeParseFailure {
  readonly success: false
  readonly issues: readonly ValidationIssue[]
}

export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure

export interface ParseOptions {
  readonly abortEarly?: boolean
  readonly maxIssues?: number
}

export type SchemaPresence = "required" | "optional" | "defaulted"

export interface RefinementOptions {
  readonly code?: string
  readonly message?: string
}

/** A synchronous schema compatible with Standard Schema V1. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>
}

export declare namespace StandardSchemaV1 {
  interface Props<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
      options?: Options | undefined,
    ) => Result<Output> | Promise<Result<Output>>
    readonly types?: Types<Input, Output> | undefined
  }

  interface Types<Input = unknown, Output = Input> {
    readonly input: Input
    readonly output: Output
  }

  type Result<Output> = SuccessResult<Output> | FailureResult

  interface SuccessResult<Output> {
    readonly value: Output
    readonly issues?: undefined
  }

  interface FailureResult {
    readonly issues: ReadonlyArray<Issue>
  }

  interface Issue {
    readonly message: string
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined
  }

  interface PathSegment {
    readonly key: PropertyKey
  }

  interface Options {
    readonly libraryOptions?: Record<string, unknown> | undefined
  }

  type InferInput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["input"]

  type InferOutput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["output"]
}

interface KernStandardSchemaProps<Input, Output> extends StandardSchemaV1.Props<Input, Output> {
  readonly vendor: "kern"
  readonly validate: (
    value: unknown,
    options?: StandardSchemaV1.Options | undefined,
  ) => StandardSchemaV1.Result<Output>
}

export interface Schema<Output, Input = Output, Presence extends SchemaPresence = "required">
  extends StandardSchemaV1<Input, Output> {
  parse(input: unknown, options?: ParseOptions): Output
  safeParse(input: unknown, options?: ParseOptions): SafeParseResult<Output>
  optional(): Schema<Output | undefined, Input | undefined, "optional">
  nullable(): Schema<Output | null, Input | null, Presence>
  default(
    value: Exclude<Output, undefined>,
  ): Schema<Exclude<Output, undefined>, Input | undefined, "defaulted">
  refine<Narrowed extends Output>(
    predicate: (value: Output) => value is Narrowed,
    options?: string | RefinementOptions,
  ): Schema<Narrowed, Input, Presence>
  refine(
    predicate: (value: Output) => boolean,
    options?: string | RefinementOptions,
  ): Schema<Output, Input, Presence>
  transform<U>(transformer: (value: Output) => U): Schema<U, Input, Presence>
  readonly "~standard": KernStandardSchemaProps<Input, Output>
}

/** @internal Package-private schema state used by Kern's combinators. */
export interface InternalSchema<
  Output,
  Input = Output,
  Presence extends SchemaPresence = "required",
> extends Schema<Output, Input, Presence> {
  readonly _fast: FastValidator<Output> | undefined
  readonly _run: Validator<Output>
  readonly _presence: Presence
}

export type InferOutput<S extends Schema<unknown, unknown, SchemaPresence>> =
  S extends Schema<infer Output, unknown, SchemaPresence> ? Output : never

export type InferInput<S extends Schema<unknown, unknown, SchemaPresence>> =
  S extends Schema<unknown, infer Input, SchemaPresence> ? Input : never

export type Infer<S extends Schema<unknown, unknown, SchemaPresence>> = InferOutput<S>

/** @internal Unique failure marker that cannot collide with consumer data. */
export const FAILURE = Symbol("kern.validation.failure")

/** @internal Package-private validator result. */
export type InternalResult<T> = T | typeof FAILURE

/** @internal Allocation-light validator used only by compatible built-in schema graphs. */
export type FastValidator<T> = (input: unknown) => InternalResult<T>

/** @internal Mutable state shared by nested validators. */
export interface ValidationContext {
  readonly issues: ValidationIssue[]
  readonly limit: number
  path: PathSegment[] | undefined
}

/** @internal Package-private validator signature. */
export type Validator<T> = (input: unknown, context: ValidationContext) => InternalResult<T>

export type AnySchema = Schema<unknown, unknown, SchemaPresence>

/** @internal Describes an input without retaining it in an issue. */
export function valueKind(value: unknown): ValueKind {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  if (value instanceof Date) return "date"
  if (typeof value === "number" && Number.isNaN(value)) return "nan"
  return typeof value
}

/** @internal Reports whether nested validation may emit another issue. */
export function hasIssueCapacity(context: ValidationContext): boolean {
  return context.issues.length < context.limit
}
