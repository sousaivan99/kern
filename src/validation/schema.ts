import { ValidationError } from "./errors.js"
import {
  failure,
  type InternalResult,
  type RefinementOptions,
  type Schema,
  type SchemaPresence,
  schemaPresence,
  success,
  type Validator,
} from "./types.js"

const validationException = (): InternalResult<never> =>
  failure([], "validation_exception", "Validation could not be completed")

const refinementDetails = (
  options: string | RefinementOptions | undefined,
): Required<RefinementOptions> => {
  if (typeof options === "string") return { code: "custom", message: options }
  return {
    code: options?.code ?? "custom",
    message: options?.message ?? "Value did not satisfy refinement",
  }
}

/** @internal */
export const createSchema = <T, Presence extends SchemaPresence = "required">(
  validator: Validator<T>,
  presence: Presence = "required" as Presence,
): Schema<T, Presence> => ({
  _run: validator,
  [schemaPresence]: presence,

  parse(input: unknown): T {
    const result = this.safeParse(input)
    if (result.success) return result.data
    throw new ValidationError(result.errors)
  },

  safeParse(input: unknown) {
    try {
      return validator(input, [])
    } catch {
      return validationException()
    }
  },

  optional() {
    return createSchema<T | undefined, "optional">(
      (input, path) => (input === undefined ? success(undefined) : validator(input, path)),
      "optional",
    )
  },

  nullable() {
    return createSchema<T | null, Presence>(
      (input, path) => (input === null ? success(null) : validator(input, path)),
      presence,
    )
  },

  default(value) {
    if (value === undefined) throw new TypeError("Default value cannot be undefined")
    return createSchema<Exclude<T, undefined>, "defaulted">((input, path) => {
      if (input === undefined) return success(value)
      const result = validator(input, path)
      if (!result.success) return result
      return success(result.data === undefined ? value : (result.data as Exclude<T, undefined>))
    }, "defaulted")
  },

  transform<U>(transformer: (value: T) => U) {
    return createSchema<U, Presence>((input, path) => {
      const result = validator(input, path)
      if (!result.success) return result
      try {
        return success(transformer(result.data))
      } catch {
        return failure(path, "transform_error", "Transformation failed")
      }
    }, presence)
  },

  refine<Narrowed extends T = T>(
    predicate: ((value: T) => boolean) | ((value: T) => value is Narrowed),
    options?: string | RefinementOptions,
  ) {
    const details = refinementDetails(options)
    return createSchema<Narrowed, Presence>((input, path) => {
      const result = validator(input, path)
      if (!result.success) return result
      try {
        return predicate(result.data)
          ? success(result.data as Narrowed)
          : failure(path, details.code, details.message)
      } catch {
        return failure(path, details.code, details.message)
      }
    }, presence)
  },
})
