import { createSchema, failure } from "../schema.js"
import {
  FAILURE,
  type InternalResult,
  type Schema,
  type ValidationContext,
  valueKind,
} from "../types.js"

type StringOperation = (value: string, context?: ValidationContext) => InternalResult<string>
type FastStringOperation = (value: string) => InternalResult<string>

/** Fluent transformations and constraints for a non-coercive string schema. */
export interface StringSchema extends Schema<string> {
  min(length: number, message?: string): StringSchema
  max(length: number, message?: string): StringSchema
  length(length: number, message?: string): StringSchema
  email(message?: string): StringSchema
  url(message?: string): StringSchema
  uuid(message?: string): StringSchema
  regex(pattern: RegExp, message?: string): StringSchema
  startsWith(prefix: string, message?: string): StringSchema
  endsWith(suffix: string, message?: string): StringSchema
  trim(): StringSchema
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

const validLength = (length: number): void => {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError("String lengths must be non-negative safe integers")
  }
}

const baseFastValidator = (input: unknown): InternalResult<string> =>
  typeof input === "string" ? input : FAILURE

const createStringSchema = (
  operations: readonly StringOperation[] = [],
  fastValidator = baseFastValidator,
): StringSchema => {
  const validate = (input: unknown, context?: ValidationContext): InternalResult<string> => {
    if (typeof input !== "string") {
      return failure(context, "invalid_type", "Expected a string", {
        expected: "string",
        received: valueKind(input),
      })
    }
    let value = input
    for (const operation of operations) {
      const result = operation(value, context)
      if (result === FAILURE) return FAILURE
      value = result
    }
    return value
  }
  const base = createSchema<string>(validate, "required", fastValidator, undefined, false)

  const append = (operation: StringOperation, fastOperation: FastStringOperation): StringSchema =>
    createStringSchema([...operations, operation], (input) => {
      const result = fastValidator(input)
      return result === FAILURE ? FAILURE : fastOperation(result)
    })

  return Object.assign(base, {
    min(length: number, message = `Expected at least ${length} characters`) {
      validLength(length)
      return append(
        (value, context) =>
          value.length >= length
            ? value
            : failure(context, "too_small", message, {
                received: "string",
                details: { minimum: length },
              }),
        (value) => (value.length >= length ? value : FAILURE),
      )
    },
    max(length: number, message = `Expected at most ${length} characters`) {
      validLength(length)
      return append(
        (value, context) =>
          value.length <= length
            ? value
            : failure(context, "too_big", message, {
                received: "string",
                details: { maximum: length },
              }),
        (value) => (value.length <= length ? value : FAILURE),
      )
    },
    length(length: number, message = `Expected exactly ${length} characters`) {
      validLength(length)
      return append(
        (value, context) =>
          value.length === length
            ? value
            : failure(context, "invalid_length", message, {
                received: "string",
                details: { length },
              }),
        (value) => (value.length === length ? value : FAILURE),
      )
    },
    email(message = "Invalid email address") {
      return append(
        (value, context) =>
          emailPattern.test(value)
            ? value
            : failure(context, "invalid_email", message, { received: "string" }),
        (value) => (emailPattern.test(value) ? value : FAILURE),
      )
    },
    url(message = "Invalid URL") {
      const validateUrl = (value: string): InternalResult<string> => {
        try {
          new URL(value)
          return value
        } catch {
          return FAILURE
        }
      }
      return append((value, context) => {
        const result = validateUrl(value)
        return result === FAILURE
          ? failure(context, "invalid_url", message, { received: "string" })
          : result
      }, validateUrl)
    },
    uuid(message = "Invalid UUID") {
      return append(
        (value, context) =>
          uuidPattern.test(value)
            ? value
            : failure(context, "invalid_uuid", message, { received: "string" }),
        (value) => (uuidPattern.test(value) ? value : FAILURE),
      )
    },
    regex(pattern: RegExp, message = "String does not match the required pattern") {
      const localPattern = new RegExp(pattern.source, pattern.flags)
      const matches = (value: string): InternalResult<string> => {
        localPattern.lastIndex = 0
        const valid = localPattern.test(value)
        localPattern.lastIndex = 0
        return valid ? value : FAILURE
      }
      return append(
        (value, context) =>
          matches(value) === FAILURE
            ? failure(context, "invalid_string", message, { received: "string" })
            : value,
        matches,
      )
    },
    startsWith(prefix: string, message = `Expected a string starting with ${prefix}`) {
      return append(
        (value, context) =>
          value.startsWith(prefix)
            ? value
            : failure(context, "invalid_starts_with", message, { received: "string" }),
        (value) => (value.startsWith(prefix) ? value : FAILURE),
      )
    },
    endsWith(suffix: string, message = `Expected a string ending with ${suffix}`) {
      return append(
        (value, context) =>
          value.endsWith(suffix)
            ? value
            : failure(context, "invalid_ends_with", message, { received: "string" }),
        (value) => (value.endsWith(suffix) ? value : FAILURE),
      )
    },
    trim() {
      return append(
        (value) => value.trim(),
        (value) => value.trim(),
      )
    },
  })
}

/** Creates a non-coercive string schema whose lengths use UTF-16 code units. */
export const string = (): StringSchema => createStringSchema()
