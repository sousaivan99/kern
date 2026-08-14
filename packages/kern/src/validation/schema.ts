import { ValidationError } from "./errors.js"
import {
  addIssue,
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
  path: readonly PathSegment[],
  code: string,
  message: string,
  metadata: Pick<ValidationIssue, "expected" | "received" | "details"> = {},
): void {
  addIssue(context, { path, code, message, ...metadata })
}

function createContext(options: ParseOptions | undefined): ValidationContext {
  const maxIssues = options?.maxIssues
  if (maxIssues !== undefined && (!Number.isSafeInteger(maxIssues) || maxIssues <= 0)) {
    throw new RangeError("maxIssues must be a positive safe integer")
  }

  return {
    issues: [],
    limit: options?.abortEarly ? 1 : (maxIssues ?? Number.POSITIVE_INFINITY),
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
): InternalSchema<Output, Input, Presence> {
  const safeParse = (input: unknown, options?: ParseOptions): SafeParseResult<Output> => {
    const context = createContext(options)

    try {
      const result = validator(input, [], context)
      if (result.success && context.issues.length === 0) return result
    } catch {
      issue(context, [], "validation_exception", "Validation failed unexpectedly")
    }

    return { success: false, issues: context.issues }
  }

  return {
    _run: validator,
    _presence: presence,
    parse(input, options) {
      const result = safeParse(input, options)
      if (result.success) return result.data
      throw new ValidationError(result.issues)
    },
    safeParse,
    optional() {
      return createSchema<Output | undefined, Input | undefined, "optional">(
        (input, path, context) =>
          input === undefined
            ? { success: true, data: undefined }
            : validator(input, path, context),
        "optional",
      )
    },
    nullable() {
      return createSchema<Output | null, Input | null, Presence>(
        (input, path, context) =>
          input === null ? { success: true, data: null } : validator(input, path, context),
        presence,
      )
    },
    default(value) {
      if (value === undefined) throw new TypeError("Default value cannot be undefined")
      return createSchema<Exclude<Output, undefined>, Input | undefined, "defaulted">(
        (input, path, context) => {
          if (input === undefined) return { success: true, data: value }
          const result = validator(input, path, context)
          if (!result.success) return result
          return {
            success: true,
            data: result.data === undefined ? value : (result.data as Exclude<Output, undefined>),
          }
        },
        "defaulted",
      )
    },
    refine(predicate: (value: Output) => boolean, options?: string | RefinementOptions) {
      const details = refinementDetails(options)
      return createSchema<Output, Input, Presence>((input, path, context) => {
        const result = validator(input, path, context)
        if (!result.success) return result

        try {
          if (predicate(result.data)) return result
        } catch {
          issue(context, path, "validation_exception", "Validation callback failed")
          return { success: false }
        }

        issue(context, path, details.code, details.message)
        return { success: false }
      }, presence)
    },
    transform(transformer) {
      return createSchema<ReturnType<typeof transformer>, Input, Presence>(
        (input, path, context) => {
          const result = validator(input, path, context)
          if (!result.success) return result

          try {
            return { success: true, data: transformer(result.data) }
          } catch {
            issue(context, path, "validation_exception", "Validation callback failed", {
              received: valueKind(result.data),
            })
            return { success: false }
          }
        },
        presence,
      )
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
  context: ValidationContext,
  path: readonly PathSegment[],
  code: string,
  message: string,
  metadata: Pick<ValidationIssue, "expected" | "received" | "details"> = {},
): { readonly success: false } {
  issue(context, path, code, message, metadata)
  return { success: false }
}

export function validationException(
  context: ValidationContext,
  path: readonly PathSegment[],
): { readonly success: false } {
  return failure(context, path, "validation_exception", "Validation failed unexpectedly")
}
