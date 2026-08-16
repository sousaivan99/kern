import { ValidationError } from "./errors.js"
import {
  FAILURE,
  type FastValidator,
  type InternalSchema,
  type ParseOptions,
  type PathSegment,
  type RefinementOptions,
  type SafeParseResult,
  type SchemaPresence,
  type ValidationContext,
  type ValidationIssue,
  type Validator,
  valueKind,
} from "./types.js"

function issue(
  context: ValidationContext,
  code: string,
  message: string,
  metadata: Pick<ValidationIssue, "expected" | "received" | "details"> = {},
): void {
  if (context.issues.length < context.limit) {
    context.issues.push({ path: context.path?.slice() ?? [], code, message, ...metadata })
  }
}

const FAST_EXCEPTION = Symbol("kern.validation.fast_exception")
interface FastException {
  readonly marker: typeof FAST_EXCEPTION
  readonly path: PathSegment[]
}

const isFastException = (value: unknown): value is FastException =>
  typeof value === "object" && value !== null && Reflect.get(value, "marker") === FAST_EXCEPTION

/** @internal Preserves a nested path when an input accessor throws on the fast success path. */
export function rethrowFastException(error: unknown, segment: PathSegment): never {
  if (isFastException(error)) {
    error.path.unshift(segment)
    throw error
  }
  throw { marker: FAST_EXCEPTION, path: [segment] } satisfies FastException
}

const exceptionPath = (error: unknown): PathSegment[] | undefined =>
  isFastException(error) ? error.path : undefined

function createContext(options: ParseOptions | undefined): ValidationContext {
  if (options === undefined) {
    return { issues: [], limit: Number.POSITIVE_INFINITY, path: undefined }
  }
  const maxIssues = options.maxIssues
  if (maxIssues !== undefined && (!Number.isSafeInteger(maxIssues) || maxIssues <= 0)) {
    throw new RangeError("maxIssues must be a positive safe integer")
  }

  return {
    issues: [],
    limit: options.abortEarly ? 1 : (maxIssues ?? Number.POSITIVE_INFINITY),
    path: undefined,
  }
}

function refinementDetails(
  options: string | RefinementOptions | undefined,
): Required<RefinementOptions> {
  if (typeof options === "string") return { code: "custom", message: options }
  return {
    code: options?.code ?? "custom",
    message: options?.message ?? "Value did not satisfy refinement",
  }
}

export function createSchema<Output, Input = Output, Presence extends SchemaPresence = "required">(
  validator: Validator<Output>,
  presence: Presence = "required" as Presence,
  fastValidator?: FastValidator<Output>,
  fastSafeParse?: (input: unknown) => SafeParseResult<Output>,
  catchFastExceptions = true,
): InternalSchema<Output, Input, Presence> {
  const safeParse = (input: unknown, options?: ParseOptions): SafeParseResult<Output> => {
    if (options === undefined && fastSafeParse) {
      try {
        return fastSafeParse(input)
      } catch (error) {
        const context = createContext(undefined)
        context.path = exceptionPath(error)
        issue(context, "validation_exception", "Validation failed unexpectedly")
        return { success: false, issues: context.issues }
      }
    }
    const context = createContext(options)

    try {
      const result = validator(input, context)
      if (result !== FAILURE && context.issues.length === 0) {
        return { success: true, data: result }
      }
    } catch {
      if (context.path) context.path.length = 0
      issue(context, "validation_exception", "Validation failed unexpectedly")
    }

    return { success: false, issues: context.issues }
  }

  const fast = fastValidator
  const parse = (input: unknown, options?: ParseOptions): Output => {
    if (options === undefined && fast) {
      if (!catchFastExceptions) {
        const result = fast(input)
        if (result !== FAILURE) return result
      } else {
        try {
          const result = fast(input)
          if (result !== FAILURE) return result
        } catch (error) {
          const context = createContext(undefined)
          context.path = exceptionPath(error)
          issue(context, "validation_exception", "Validation failed unexpectedly")
          throw new ValidationError(context.issues)
        }
      }
    }
    const context = createContext(options)
    try {
      const result = validator(input, context)
      if (result !== FAILURE && context.issues.length === 0) return result
    } catch {
      if (context.path) context.path.length = 0
      issue(context, "validation_exception", "Validation failed unexpectedly")
    }
    throw new ValidationError(context.issues)
  }

  return {
    _fast: fastValidator,
    _run: validator,
    _presence: presence,
    parse,
    safeParse,
    optional() {
      return createSchema<Output | undefined, Input | undefined, "optional">(
        (input, context) => (input === undefined ? undefined : validator(input, context)),
        "optional",
        fastValidator
          ? (input) => (input === undefined ? undefined : fastValidator(input))
          : undefined,
      )
    },
    nullable() {
      return createSchema<Output | null, Input | null, Presence>(
        (input, context) => (input === null ? null : validator(input, context)),
        presence,
        fastValidator ? (input) => (input === null ? null : fastValidator(input)) : undefined,
      )
    },
    default(value) {
      if (value === undefined) throw new TypeError("Default value cannot be undefined")
      return createSchema<Exclude<Output, undefined>, Input | undefined, "defaulted">(
        (input, context) => {
          if (input === undefined) return value
          const result = validator(input, context)
          if (result === FAILURE) return FAILURE
          const parsed = result as Output
          return parsed === undefined ? value : (parsed as Exclude<Output, undefined>)
        },
        "defaulted",
        fastValidator
          ? (input) => {
              if (input === undefined) return value
              const result = fastValidator(input)
              if (result === FAILURE) return FAILURE
              return result === undefined ? value : (result as Exclude<Output, undefined>)
            }
          : undefined,
      )
    },
    refine(predicate: (value: Output) => boolean, options?: string | RefinementOptions) {
      const details = refinementDetails(options)
      return createSchema<Output, Input, Presence>((input, context) => {
        const result = validator(input, context)
        if (result === FAILURE) return FAILURE

        try {
          if (predicate(result)) return result
        } catch {
          issue(context, "validation_exception", "Validation callback failed")
          return FAILURE
        }

        issue(context, details.code, details.message)
        return FAILURE
      }, presence)
    },
    transform(transformer) {
      return createSchema<ReturnType<typeof transformer>, Input, Presence>((input, context) => {
        const result = validator(input, context)
        if (result === FAILURE) return FAILURE

        try {
          return transformer(result as Output)
        } catch {
          issue(context, "validation_exception", "Validation callback failed", {
            received: valueKind(result),
          })
          return FAILURE
        }
      }, presence)
    },
    "~standard": {
      version: 1,
      vendor: "kern",
      validate(value, _options) {
        const result = safeParse(value)
        return result.success ? { value: result.data } : { issues: result.issues }
      },
    },
  }
}

export function failure(
  context: ValidationContext | undefined,
  code: string,
  message: string,
  metadata: Pick<ValidationIssue, "expected" | "received" | "details"> = {},
): typeof FAILURE {
  if (context) issue(context, code, message, metadata)
  return FAILURE
}

export function validationException(context: ValidationContext): typeof FAILURE {
  return failure(context, "validation_exception", "Validation failed unexpectedly")
}
