import { createSchema } from "../schema.js"
import { failure, type Schema, success } from "../types.js"

export { type NumberSchema, number } from "./number.js"
export { type StringSchema, string } from "./string.js"

/** Validates a boolean without coercion. */
export const boolean = (): Schema<boolean> =>
  createSchema((input, path) =>
    typeof input === "boolean"
      ? success(input)
      : failure(path, "invalid_type", "Expected a boolean"),
  )

/** Validates a valid native `Date` instance without cloning it. */
export const date = (): Schema<Date> =>
  createSchema((input, path) =>
    input instanceof Date && !Number.isNaN(input.getTime())
      ? success(input)
      : failure(path, "invalid_type", "Expected a valid Date"),
  )

type LiteralValue = string | number | bigint | boolean | null | undefined

/** Validates one exact primitive literal using `Object.is`. */
export const literal = <const T extends LiteralValue>(expected: T): Schema<T> =>
  createSchema((input, path) =>
    Object.is(input, expected)
      ? success(expected)
      : failure(path, "invalid_literal", `Expected literal ${String(expected)}`),
  )

/** Validates one member of a non-empty readonly string tuple. */
export const enumeration = <const T extends readonly [string, ...string[]]>(
  values: T,
): Schema<T[number]> => {
  const allowed = new Set<string>(values)
  return createSchema((input, path) =>
    typeof input === "string" && allowed.has(input)
      ? success(input as T[number])
      : failure(path, "invalid_enum", `Expected one of: ${values.join(", ")}`),
  )
}
