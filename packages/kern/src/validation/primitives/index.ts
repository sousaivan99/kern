import { createSchema, failure } from "../schema.js"
import { FAILURE, type Schema, valueKind } from "../types.js"

export { type NumberSchema, number } from "./number.js"
export { type StringSchema, string } from "./string.js"

/** Validates a boolean without coercion. */
export const boolean = (): Schema<boolean> =>
  createSchema(
    (input, context) =>
      typeof input === "boolean"
        ? input
        : failure(context, "invalid_type", "Expected a boolean", {
            expected: "boolean",
            received: valueKind(input),
          }),
    "required",
    (input) => (typeof input === "boolean" ? input : FAILURE),
  )

/** Validates a valid native `Date` instance without cloning it. */
export const date = (): Schema<Date> =>
  createSchema(
    (input, context) =>
      input instanceof Date && !Number.isNaN(input.getTime())
        ? input
        : failure(context, "invalid_type", "Expected a valid Date", {
            expected: "valid Date",
            received: valueKind(input),
          }),
    "required",
    (input) => (input instanceof Date && !Number.isNaN(input.getTime()) ? input : FAILURE),
  )

type LiteralValue = string | number | bigint | boolean | null | undefined

/** Validates one exact primitive literal using `Object.is`. */
export const literal = <const T extends LiteralValue>(expected: T): Schema<T> =>
  createSchema(
    (input, context) =>
      Object.is(input, expected)
        ? expected
        : failure(context, "invalid_literal", `Expected literal ${String(expected)}`, {
            expected: String(expected),
            received: valueKind(input),
          }),
    "required",
    (input) => (Object.is(input, expected) ? expected : FAILURE),
  )

/** Validates one member of a non-empty readonly string tuple. */
export const enumeration = <const T extends readonly [string, ...string[]]>(
  values: T,
): Schema<T[number]> => {
  const allowed = new Set<string>(values)
  return createSchema(
    (input, context) =>
      typeof input === "string" && allowed.has(input)
        ? (input as T[number])
        : failure(context, "invalid_enum", `Expected one of: ${values.join(", ")}`, {
            expected: values.join(" | "),
            received: valueKind(input),
          }),
    "required",
    (input) => (typeof input === "string" && allowed.has(input) ? (input as T[number]) : FAILURE),
  )
}
