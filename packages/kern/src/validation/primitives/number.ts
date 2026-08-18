import { createSchema, failure } from "../schema.js"
import {
  FAILURE,
  type InternalResult,
  type Schema,
  type ValidationContext,
  valueKind,
} from "../types.js"

type NumberOperation = (value: number, context?: ValidationContext) => InternalResult<number>
type FastNumberOperation = (value: number) => InternalResult<number>

/** Fluent constraints for a non-coercive number schema. */
export interface NumberSchema extends Schema<number> {
  min(value: number, message?: string): NumberSchema
  max(value: number, message?: string): NumberSchema
  positive(message?: string): NumberSchema
  negative(message?: string): NumberSchema
  integer(message?: string): NumberSchema
  finite(message?: string): NumberSchema
}

const baseFastValidator = (input: unknown): InternalResult<number> =>
  typeof input === "number" && !Number.isNaN(input) ? input : FAILURE

const createNumberSchema = (
  operations: readonly NumberOperation[] = [],
  fastValidator = baseFastValidator,
): NumberSchema => {
  const validate = (input: unknown, context?: ValidationContext): InternalResult<number> => {
    if (typeof input !== "number" || Number.isNaN(input)) {
      return failure(context, "invalid_type", "Expected a number", {
        expected: "number",
        received: valueKind(input),
      })
    }
    for (const operation of operations) {
      const result = operation(input, context)
      if (result === FAILURE) return FAILURE
    }
    return input
  }
  const base = createSchema<number>(validate, "required", fastValidator, undefined, false)
  const append = (operation: NumberOperation, fastOperation: FastNumberOperation): NumberSchema =>
    createNumberSchema([...operations, operation], (input) => {
      const result = fastValidator(input)
      return result === FAILURE ? FAILURE : fastOperation(result)
    })

  return Object.assign(base, {
    min(value: number, message = `Expected a number greater than or equal to ${value}`) {
      if (Number.isNaN(value)) throw new RangeError("Minimum cannot be NaN")
      return append(
        (input, context) =>
          input >= value
            ? input
            : failure(context, "too_small", message, {
                received: "number",
                details: { minimum: value },
              }),
        (input) => (input >= value ? input : FAILURE),
      )
    },
    max(value: number, message = `Expected a number less than or equal to ${value}`) {
      if (Number.isNaN(value)) throw new RangeError("Maximum cannot be NaN")
      return append(
        (input, context) =>
          input <= value
            ? input
            : failure(context, "too_big", message, {
                received: "number",
                details: { maximum: value },
              }),
        (input) => (input <= value ? input : FAILURE),
      )
    },
    positive(message = "Expected a positive number") {
      return append(
        (value, context) =>
          value > 0 ? value : failure(context, "not_positive", message, { received: "number" }),
        (value) => (value > 0 ? value : FAILURE),
      )
    },
    negative(message = "Expected a negative number") {
      return append(
        (value, context) =>
          value < 0 ? value : failure(context, "not_negative", message, { received: "number" }),
        (value) => (value < 0 ? value : FAILURE),
      )
    },
    integer(message = "Expected an integer") {
      return append(
        (value, context) =>
          Number.isInteger(value)
            ? value
            : failure(context, "not_integer", message, {
                received: "number",
                details: { integer: true },
              }),
        (value) => (Number.isInteger(value) ? value : FAILURE),
      )
    },
    finite(message = "Expected a finite number") {
      return append(
        (value, context) =>
          Number.isFinite(value)
            ? value
            : failure(context, "not_finite", message, {
                received: "number",
                details: { finite: true },
              }),
        (value) => (Number.isFinite(value) ? value : FAILURE),
      )
    },
  })
}

/** Creates a non-coercive number schema; use `.finite()` to reject infinities. */
export const number = (): NumberSchema => createNumberSchema()
