import { createSchema, failure } from "../schema.js"
import { type Schema, success, valueKind } from "../types.js"

export { type NumberSchema, number } from "./number.js"
export { type StringSchema, string } from "./string.js"

/** Validates a boolean without coercion. */
export const boolean = (): Schema<boolean> =>
  createSchema((input, path, context) =>
    typeof input === "boolean"
      ? success(input)
      : failure(context, path, "invalid_type", "Expected a boolean", {
          expected: "boolean",
          received: valueKind(input),
        }),
  )

/** Validates a valid native `Date` instance without cloning it. */
export const date = (): Schema<Date> =>
  createSchema((input, path, context) =>
    input instanceof Date && !Number.isNaN(input.getTime())
      ? success(input)
      : failure(context, path, "invalid_type", "Expected a valid Date", {
          expected: "valid Date",
          received: valueKind(input),
        }),
  )

type LiteralValue = string | number | bigint | boolean | null | undefined

/** Validates one exact primitive literal using `Object.is`. */
export const literal = <const T extends LiteralValue>(expected: T): Schema<T> =>
  createSchema((input, path, context) =>
    Object.is(input, expected)
      ? success(expected)
      : failure(context, path, "invalid_literal", `Expected literal ${String(expected)}`, {
          expected: String(expected),
          received: valueKind(input),
        }),
  )

/** Validates one member of a non-empty readonly string tuple. */
export const enumeration = <const T extends readonly [string, ...string[]]>(
  values: T,
): Schema<T[number]> => {
  const allowed = new Set<string>(values)
  return createSchema((input, path, context) =>
    typeof input === "string" && allowed.has(input)
      ? success(input as T[number])
      : failure(context, path, "invalid_enum", `Expected one of: ${values.join(", ")}`, {
          expected: values.join(" | "),
          received: valueKind(input),
        }),
  )
}
