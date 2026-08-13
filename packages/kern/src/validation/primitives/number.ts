import { createSchema, failure } from "../schema.js"
import {
  type InternalResult,
  type PathSegment,
  type Schema,
  success,
  type ValidationContext,
  valueKind,
} from "../types.js"

type NumberOperation = (
  value: number,
  path: readonly PathSegment[],
  context: ValidationContext,
) => InternalResult<number>

/** Fluent constraints for a non-coercive number schema. */
export interface NumberSchema extends Schema<number> {
  min(value: number, message?: string): NumberSchema
  max(value: number, message?: string): NumberSchema
  positive(message?: string): NumberSchema
  negative(message?: string): NumberSchema
  integer(message?: string): NumberSchema
  finite(message?: string): NumberSchema
}

const createNumberSchema = (operations: readonly NumberOperation[] = []): NumberSchema => {
  const base = createSchema<number>((input, path, context) => {
    if (typeof input !== "number" || Number.isNaN(input)) {
      return failure(context, path, "invalid_type", "Expected a number", {
        expected: "number",
        received: valueKind(input),
      })
    }
    for (const operation of operations) {
      const result = operation(input, path, context)
      if (!result.success) return result
    }
    return success(input)
  })
  const check = (
    predicate: (value: number) => boolean,
    code: string,
    message: string,
    details?: Readonly<Record<string, string | number | boolean | null>>,
  ): NumberSchema =>
    createNumberSchema([
      ...operations,
      (value, path, context) =>
        predicate(value)
          ? success(value)
          : failure(context, path, code, message, {
              received: valueKind(value),
              ...(details ? { details } : {}),
            }),
    ])

  return Object.assign(base, {
    min(value: number, message = `Expected a number greater than or equal to ${value}`) {
      if (Number.isNaN(value)) throw new RangeError("Minimum cannot be NaN")
      return check((input) => input >= value, "too_small", message, { minimum: value })
    },
    max(value: number, message = `Expected a number less than or equal to ${value}`) {
      if (Number.isNaN(value)) throw new RangeError("Maximum cannot be NaN")
      return check((input) => input <= value, "too_big", message, { maximum: value })
    },
    positive(message = "Expected a positive number") {
      return check((value) => value > 0, "not_positive", message)
    },
    negative(message = "Expected a negative number") {
      return check((value) => value < 0, "not_negative", message)
    },
    integer(message = "Expected an integer") {
      return check(Number.isInteger, "not_integer", message, { integer: true })
    },
    finite(message = "Expected a finite number") {
      return check(Number.isFinite, "not_finite", message, { finite: true })
    },
  })
}

/** Creates a non-coercive number schema; use `.finite()` to reject infinities. */
export const number = (): NumberSchema => createNumberSchema()
