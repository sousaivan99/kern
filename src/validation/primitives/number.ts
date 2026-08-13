import { createSchema } from "../schema.js"
import { failure, type InternalResult, type PathSegment, type Schema, success } from "../types.js"

type NumberOperation = (value: number, path: readonly PathSegment[]) => InternalResult<number>

/** Fluent constraints for a non-coercive number schema. */
export interface NumberSchema extends Schema<number> {
  /** Requires a value greater than or equal to `value`. */
  min(value: number, message?: string): NumberSchema
  /** Requires a value less than or equal to `value`. */
  max(value: number, message?: string): NumberSchema
  /** Requires a value greater than zero. */
  positive(message?: string): NumberSchema
  /** Requires a value less than zero. */
  negative(message?: string): NumberSchema
  /** Requires an integer. */
  integer(message?: string): NumberSchema
  /** Rejects positive and negative infinity. */
  finite(message?: string): NumberSchema
}

const createNumberSchema = (operations: readonly NumberOperation[] = []): NumberSchema => {
  const base = createSchema<number>((input, path) => {
    if (typeof input !== "number" || Number.isNaN(input)) {
      return failure(path, "invalid_type", "Expected a number")
    }
    for (const operation of operations) {
      const result = operation(input, path)
      if (!result.success) return result
    }
    return success(input)
  })
  const check = (
    predicate: (value: number) => boolean,
    code: string,
    message: string,
  ): NumberSchema =>
    createNumberSchema([
      ...operations,
      (value, path) => (predicate(value) ? success(value) : failure(path, code, message)),
    ])

  return Object.assign(base, {
    min(value: number, message = `Expected a number greater than or equal to ${value}`) {
      if (Number.isNaN(value)) throw new RangeError("Minimum cannot be NaN")
      return check((input) => input >= value, "too_small", message)
    },
    max(value: number, message = `Expected a number less than or equal to ${value}`) {
      if (Number.isNaN(value)) throw new RangeError("Maximum cannot be NaN")
      return check((input) => input <= value, "too_big", message)
    },
    positive(message = "Expected a positive number") {
      return check((value) => value > 0, "not_positive", message)
    },
    negative(message = "Expected a negative number") {
      return check((value) => value < 0, "not_negative", message)
    },
    integer(message = "Expected an integer") {
      return check(Number.isInteger, "not_integer", message)
    },
    finite(message = "Expected a finite number") {
      return check(Number.isFinite, "not_finite", message)
    },
  })
}

/** Creates a non-coercive number schema; use `.finite()` to reject infinities. */
export const number = (): NumberSchema => createNumberSchema()
