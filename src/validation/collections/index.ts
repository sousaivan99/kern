import { createSchema } from "../schema.js"
import {
  type AnySchema,
  failure,
  type Infer,
  type InternalResult,
  type Schema,
  schemaPresence,
  success,
  type ValidationIssue,
} from "../types.js"

/** Validates every array element and reports all element issues with indexed paths. */
export const array = <S extends AnySchema>(element: S): Schema<Array<Infer<S>>, "required"> =>
  createSchema((input, path) => {
    if (!Array.isArray(input)) return failure(path, "invalid_type", "Expected an array")
    const output: Array<Infer<S>> = []
    const errors: ValidationIssue[] = []
    for (let index = 0; index < input.length; index += 1) {
      const result = element._run(input[index], [...path, index])
      if (result.success) output.push(result.data as Infer<S>)
      else errors.push(...result.errors)
    }
    return errors.length === 0 ? success(output) : { success: false, errors }
  })

type Shape = Readonly<Record<string, AnySchema>>
type OptionalKeys<S extends Shape> = {
  [K in keyof S]-?: S[K] extends Schema<unknown, "optional"> ? K : never
}[keyof S]
type RequiredKeys<S extends Shape> = Exclude<keyof S, OptionalKeys<S>>

/** Inferred output for an object schema, with only explicitly optional fields optional. */
export type ObjectOutput<S extends Shape> = {
  [K in RequiredKeys<S>]: Infer<S[K]>
} & {
  [K in OptionalKeys<S>]?: Exclude<Infer<S[K]>, undefined>
}

const setOwn = (target: object, key: PropertyKey, value: unknown): void => {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

const isPlainObject = (input: unknown): input is Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false
  const prototype = Object.getPrototypeOf(input)
  return prototype === Object.prototype || prototype === null
}

/** Validates a plain object shape and strips unknown enumerable string keys. */
export const object = <const S extends Shape>(shape: S): Schema<ObjectOutput<S>, "required"> =>
  createSchema((input, path) => {
    if (!isPlainObject(input)) {
      return failure(path, "invalid_type", "Expected a plain object")
    }

    const source = input
    const output: Record<string, unknown> = {}
    const errors: ValidationIssue[] = []
    for (const key of Object.keys(shape)) {
      const propertySchema = shape[key]
      if (!propertySchema) continue
      const propertyPath = [...path, key]
      if (!Object.hasOwn(source, key) && propertySchema[schemaPresence] === "required") {
        errors.push({ code: "required", message: "Required property", path: propertyPath })
        continue
      }
      const result = propertySchema._run(source[key], propertyPath)
      if (result.success) {
        if (propertySchema[schemaPresence] !== "optional" || result.data !== undefined) {
          setOwn(output, key, result.data)
        }
      } else {
        errors.push(...result.errors)
      }
    }
    return errors.length === 0
      ? success(output as ObjectOutput<S>)
      : ({ success: false, errors } satisfies InternalResult<never>)
  })

/** Validates a fixed-length tuple and reports indexed element paths. */
export const tuple = <const S extends readonly AnySchema[]>(
  schemas: S,
): Schema<{ [K in keyof S]: Infer<S[K]> }, "required"> =>
  createSchema((input, path) => {
    if (!Array.isArray(input)) return failure(path, "invalid_type", "Expected an array")
    if (input.length !== schemas.length) {
      return failure(path, "invalid_length", `Expected a tuple with ${schemas.length} items`)
    }
    const output: unknown[] = []
    const errors: ValidationIssue[] = []
    for (let index = 0; index < schemas.length; index += 1) {
      const result = schemas[index]?._run(input[index], [...path, index])
      if (!result) continue
      if (result.success) output.push(result.data)
      else errors.push(...result.errors)
    }
    return errors.length === 0
      ? success(output as { [K in keyof S]: Infer<S[K]> })
      : { success: false, errors }
  })

/** Validates every enumerable own string-keyed value in an object. */
export const record = <S extends AnySchema>(
  valueSchema: S,
): Schema<Record<string, Infer<S>>, "required"> =>
  createSchema((input, path) => {
    if (!isPlainObject(input)) {
      return failure(path, "invalid_type", "Expected a plain record")
    }
    const output: Record<string, Infer<S>> = {}
    const errors: ValidationIssue[] = []
    for (const [key, value] of Object.entries(input)) {
      const result = valueSchema._run(value, [...path, key])
      if (result.success) setOwn(output, key, result.data)
      else errors.push(...result.errors)
    }
    return errors.length === 0 ? success(output) : { success: false, errors }
  })

/** Returns the first successful member result or one `invalid_union` issue. */
export const union = <const S extends readonly [AnySchema, AnySchema, ...AnySchema[]]>(
  schemas: S,
): Schema<Infer<S[number]>, "required"> =>
  createSchema((input, path) => {
    for (const schema of schemas) {
      const result = schema._run(input, path)
      if (result.success) return success(result.data as Infer<S[number]>)
    }
    return failure(path, "invalid_union", "Value did not match any union member")
  })
