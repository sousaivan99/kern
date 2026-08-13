import { createSchema } from "../schema.js"
import { failure, type InternalResult, type PathSegment, type Schema, success } from "../types.js"

type StringOperation = (value: string, path: readonly PathSegment[]) => InternalResult<string>

/** Fluent transformations and constraints for a non-coercive string schema. */
export interface StringSchema extends Schema<string> {
  /** Requires at least `length` UTF-16 code units. */
  min(length: number, message?: string): StringSchema
  /** Requires at most `length` UTF-16 code units. */
  max(length: number, message?: string): StringSchema
  /** Requires exactly `length` UTF-16 code units. */
  length(length: number, message?: string): StringSchema
  /** Applies a deliberately small structural email check, not delivery verification. */
  email(message?: string): StringSchema
  /** Accepts any URL syntax supported by `new URL`, including non-HTTP schemes. */
  url(message?: string): StringSchema
  /** Validates canonical UUID text for versions 1 through 8. */
  uuid(message?: string): StringSchema
  /** Tests a cloned regular expression without mutating the caller's `lastIndex`. */
  regex(pattern: RegExp, message?: string): StringSchema
  /** Requires the supplied prefix. */
  startsWith(prefix: string, message?: string): StringSchema
  /** Requires the supplied suffix. */
  endsWith(suffix: string, message?: string): StringSchema
  /** Trims native JavaScript whitespace before subsequent operations. */
  trim(): StringSchema
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

const validLength = (length: number): void => {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError("String lengths must be non-negative safe integers")
  }
}

const createStringSchema = (operations: readonly StringOperation[] = []): StringSchema => {
  const base = createSchema<string>((input, path) => {
    if (typeof input !== "string") return failure(path, "invalid_type", "Expected a string")

    let value = input
    for (const operation of operations) {
      const result = operation(value, path)
      if (!result.success) return result
      value = result.data
    }
    return success(value)
  })

  const append = (operation: StringOperation): StringSchema =>
    createStringSchema([...operations, operation])
  const check = (
    predicate: (value: string) => boolean,
    code: string,
    message: string,
  ): StringSchema =>
    append((value, path) => (predicate(value) ? success(value) : failure(path, code, message)))

  return Object.assign(base, {
    min(length: number, message = `Expected at least ${length} characters`) {
      validLength(length)
      return check((value) => value.length >= length, "too_small", message)
    },
    max(length: number, message = `Expected at most ${length} characters`) {
      validLength(length)
      return check((value) => value.length <= length, "too_big", message)
    },
    length(length: number, message = `Expected exactly ${length} characters`) {
      validLength(length)
      return check((value) => value.length === length, "invalid_length", message)
    },
    email(message = "Invalid email address") {
      return check((value) => emailPattern.test(value), "invalid_email", message)
    },
    url(message = "Invalid URL") {
      return check(
        (value) => {
          try {
            new URL(value)
            return true
          } catch {
            return false
          }
        },
        "invalid_url",
        message,
      )
    },
    uuid(message = "Invalid UUID") {
      return check((value) => uuidPattern.test(value), "invalid_uuid", message)
    },
    regex(pattern: RegExp, message = "String does not match the required pattern") {
      const localPattern = new RegExp(pattern.source, pattern.flags)
      return check(
        (value) => {
          localPattern.lastIndex = 0
          const matches = localPattern.test(value)
          localPattern.lastIndex = 0
          return matches
        },
        "invalid_string",
        message,
      )
    },
    startsWith(prefix: string, message = `Expected a string starting with ${prefix}`) {
      return check((value) => value.startsWith(prefix), "invalid_starts_with", message)
    },
    endsWith(suffix: string, message = `Expected a string ending with ${suffix}`) {
      return check((value) => value.endsWith(suffix), "invalid_ends_with", message)
    },
    trim() {
      return append((value) => success(value.trim()))
    },
  })
}

/** Creates a non-coercive string schema whose lengths use UTF-16 code units. */
export const string = (): StringSchema => createStringSchema()
