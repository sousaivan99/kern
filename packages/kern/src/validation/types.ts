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

export type StandardSchemaResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly issues: readonly ValidationIssue[] }

export interface StandardSchemaV1<Input, Output> {
  readonly version: 1
  readonly vendor: "kern"
  readonly validate: (value: unknown) => StandardSchemaResult<Output>
  readonly types?: {
    readonly input: Input
    readonly output: Output
  }
}

export interface Schema<Output, Input = Output, Presence extends SchemaPresence = "required"> {
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
  readonly "~standard": StandardSchemaV1<Input, Output>
  /** @internal */
  readonly _run: Validator<Output>
  /** @internal */
  readonly _presence: Presence
}

export type InferOutput<S extends Schema<unknown, unknown, SchemaPresence>> =
  S extends Schema<infer Output, unknown, SchemaPresence> ? Output : never

export type InferInput<S extends Schema<unknown, unknown, SchemaPresence>> =
  S extends Schema<unknown, infer Input, SchemaPresence> ? Input : never

export type Infer<S extends Schema<unknown, unknown, SchemaPresence>> = InferOutput<S>

export type InternalResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false }

export interface ValidationContext {
  readonly issues: ValidationIssue[]
  readonly limit: number
}

export type Validator<T> = (
  input: unknown,
  path: readonly PathSegment[],
  context: ValidationContext,
) => InternalResult<T>

export type AnySchema = Schema<unknown, unknown, SchemaPresence>

export function success<T>(data: T): InternalResult<T> {
  return { success: true, data }
}

export function valueKind(value: unknown): ValueKind {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  if (value instanceof Date) return "date"
  if (typeof value === "number" && Number.isNaN(value)) return "nan"
  return typeof value
}

export function addIssue(context: ValidationContext, issue: ValidationIssue): void {
  if (context.issues.length < context.limit) context.issues.push(issue)
}

export function hasIssueCapacity(context: ValidationContext): boolean {
  return context.issues.length < context.limit
}
