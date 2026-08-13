/** A property segment within a structured validation issue path. */
export type PathSegment = string | number

/** One stable, structured reason that validation failed. */
export interface ValidationIssue {
  readonly path: readonly PathSegment[]
  readonly code: string
  readonly message: string
}

/** Successful `safeParse` result containing inferred output data. */
export interface SafeParseSuccess<T> {
  readonly success: true
  readonly data: T
}

/** Failed `safeParse` result containing one or more structured issues. */
export interface SafeParseFailure {
  readonly success: false
  readonly errors: readonly ValidationIssue[]
}

/** Discriminated result returned by `Schema.safeParse`. */
export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure

export type SchemaPresence = "defaulted" | "optional" | "required"
export const schemaPresence: unique symbol = Symbol("kern.schemaPresence")

/** @internal */
export type InternalResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly errors: ValidationIssue[] }

/** @internal */
export type Validator<T> = (input: unknown, path: readonly PathSegment[]) => InternalResult<T>

/** Options for a custom refinement failure. */
export interface RefinementOptions {
  readonly code?: string
  readonly message?: string
}

/** A runtime schema whose successful output is `T`. */
export interface Schema<T, Presence extends SchemaPresence = SchemaPresence> {
  readonly [schemaPresence]: Presence
  /** Parses input or throws `ValidationError` for ordinary validation failures. */
  parse(input: unknown): T
  /** Parses input without throwing for ordinary validation failures. */
  safeParse(input: unknown): SafeParseResult<T>
  /** Allows `undefined` and makes this schema optional when used as an object field. */
  optional(): Schema<T | undefined, "optional">
  /** Allows `null` while preserving object-field presence semantics. */
  nullable(): Schema<T | null, Presence>
  /** Replaces any successful `undefined` output with `value`. */
  default(value: Exclude<T, undefined>): Schema<Exclude<T, undefined>, "defaulted">
  /** Transforms successful output while preserving object-field presence semantics. */
  transform<U>(transformer: (value: T) => U): Schema<U, Presence>
  /** Narrows output only when supplied a TypeScript type guard. */
  refine<Narrowed extends T>(
    predicate: (value: T) => value is Narrowed,
    options?: string | RefinementOptions,
  ): Schema<Narrowed, Presence>
  /** Applies a boolean refinement without changing the output type. */
  refine(
    predicate: (value: T) => boolean,
    options?: string | RefinementOptions,
  ): Schema<T, Presence>
  /** @internal */
  readonly _run: Validator<T>
}

/** Any Kern schema, regardless of output or object-field presence. */
export type AnySchema = Schema<unknown, SchemaPresence>

/** Extracts the successful output type of a Kern schema. */
export type Infer<S extends AnySchema> =
  S extends Schema<infer Output, SchemaPresence> ? Output : never

/** @internal */
export const success = <T>(data: T): InternalResult<T> => ({ success: true, data })

/** @internal */
export const failure = (
  path: readonly PathSegment[],
  code: string,
  message: string,
): InternalResult<never> => ({
  success: false,
  errors: [{ path: [...path], code, message }],
})
