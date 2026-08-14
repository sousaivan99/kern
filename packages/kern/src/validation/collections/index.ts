import { createSchema, failure, validationException } from "../schema.js"
import {
  type AnySchema,
  hasIssueCapacity,
  type InferInput,
  type InferOutput,
  type InternalSchema,
  type Schema,
  type SchemaPresence,
  success,
  type ValidationContext,
  valueKind,
} from "../types.js"

const internalSchema = <S extends AnySchema>(
  schema: S,
): InternalSchema<InferOutput<S>, InferInput<S>, SchemaPresence> =>
  schema as unknown as InternalSchema<InferOutput<S>, InferInput<S>, SchemaPresence>

/** Validates every array element and reports indexed paths. */
export const array = <S extends AnySchema>(element: S): Schema<InferOutput<S>[], InferInput<S>[]> =>
  createSchema((input, path, context) => {
    if (!Array.isArray(input)) {
      return failure(context, path, "invalid_type", "Expected an array", {
        expected: "array",
        received: valueKind(input),
      })
    }

    const output: InferOutput<S>[] = []
    let valid = true
    for (let index = 0; index < input.length && hasIssueCapacity(context); index += 1) {
      const result = internalSchema(element)._run(input[index], [...path, index], context)
      if (result.success) output.push(result.data as InferOutput<S>)
      else valid = false
    }
    return valid ? success(output) : { success: false }
  })

export type Shape = Readonly<Record<string, AnySchema>>
export type UnknownKeyPolicy = "strip" | "strict" | "passthrough"

type PresenceOf<S extends AnySchema> = S extends Schema<unknown, unknown, infer P> ? P : never
type OptionalOutputKeys<S extends Shape> = {
  [K in keyof S]-?: PresenceOf<S[K]> extends "optional" ? K : never
}[keyof S]
type RequiredOutputKeys<S extends Shape> = Exclude<keyof S, OptionalOutputKeys<S>>
type OptionalInputKeys<S extends Shape> = {
  [K in keyof S]-?: PresenceOf<S[K]> extends "required" ? never : K
}[keyof S]
type RequiredInputKeys<S extends Shape> = Exclude<keyof S, OptionalInputKeys<S>>

/** Inferred parsed object, with only explicitly optional fields optional. */
export type ObjectOutput<S extends Shape> = {
  [K in RequiredOutputKeys<S>]: InferOutput<S[K]>
} & {
  [K in OptionalOutputKeys<S>]?: Exclude<InferOutput<S[K]>, undefined>
}

/** Inferred accepted object input, including optional and defaulted input keys. */
export type ObjectInput<S extends Shape> = {
  [K in RequiredInputKeys<S>]: InferInput<S[K]>
} & {
  [K in OptionalInputKeys<S>]?: InferInput<S[K]>
}

type PolicyOutput<S extends Shape, P extends UnknownKeyPolicy> = P extends "passthrough"
  ? ObjectOutput<S> & Record<string, unknown>
  : ObjectOutput<S>

type Optionalized<S extends AnySchema> =
  S extends Schema<infer O, infer I, SchemaPresence>
    ? Schema<O | undefined, I | undefined, "optional">
    : never
type PartialShape<S extends Shape> = { readonly [K in keyof S]: Optionalized<S[K]> }

export type ObjectSchema<S extends Shape, P extends UnknownKeyPolicy = "strip"> = Schema<
  PolicyOutput<S, P>,
  ObjectInput<S>
> & {
  pick<const K extends readonly (keyof S & string)[]>(keys: K): ObjectSchema<Pick<S, K[number]>, P>
  omit<const K extends readonly (keyof S & string)[]>(keys: K): ObjectSchema<Omit<S, K[number]>, P>
  partial(): ObjectSchema<PartialShape<S>, P>
  extend<const E extends Shape>(extension: E): ObjectSchema<Omit<S, keyof E> & E, P>
  strip(): ObjectSchema<S, "strip">
  strict(): ObjectSchema<S, "strict">
  passthrough(): ObjectSchema<S, "passthrough">
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

const readOwn = (
  source: Record<string, unknown>,
  key: string,
  path: readonly (string | number)[],
  context: ValidationContext,
): { success: true; value: unknown } | { success: false } => {
  try {
    return { success: true, value: source[key] }
  } catch {
    validationException(context, path)
    return { success: false }
  }
}

const createObjectSchema = <const S extends Shape, P extends UnknownKeyPolicy>(
  shape: S,
  policy: P,
): ObjectSchema<S, P> => {
  const shapeKeys = Object.keys(shape)
  const known = new Set(shapeKeys)
  const base = createSchema<PolicyOutput<S, P>, ObjectInput<S>>((input, path, context) => {
    if (!isPlainObject(input)) {
      return failure(context, path, "invalid_type", "Expected a plain object", {
        expected: "plain object",
        received: valueKind(input),
      })
    }

    const output: Record<string, unknown> = {}
    let valid = true

    for (const key of shapeKeys) {
      if (!hasIssueCapacity(context)) {
        valid = false
        break
      }
      const propertySchema = shape[key]
      if (!propertySchema) continue
      const propertyInternal = internalSchema(propertySchema)
      const propertyPath = [...path, key]
      const hasProperty = Object.hasOwn(input, key)
      if (!hasProperty && propertyInternal._presence === "required") {
        failure(context, propertyPath, "required", "Required property", {
          expected: "defined property",
          received: "undefined",
        })
        valid = false
        continue
      }

      let propertyValue: unknown
      if (hasProperty) {
        const read = readOwn(input, key, propertyPath, context)
        if (!read.success) {
          valid = false
          continue
        }
        propertyValue = read.value
      }

      const result = propertyInternal._run(propertyValue, propertyPath, context)
      if (!result.success) {
        valid = false
      } else if (propertyInternal._presence !== "optional" || result.data !== undefined) {
        setOwn(output, key, result.data)
      }
    }

    if (policy !== "strip") {
      for (const key of Object.keys(input)) {
        if (!hasIssueCapacity(context)) {
          valid = false
          break
        }
        if (known.has(key)) continue
        const unknownPath = [...path, key]
        if (policy === "strict") {
          failure(context, unknownPath, "unrecognized_key", "Unrecognized key", {
            details: { key },
          })
          valid = false
          continue
        }

        const read = readOwn(input, key, unknownPath, context)
        if (!read.success) {
          valid = false
          continue
        }
        setOwn(output, key, read.value)
      }
    }

    return valid ? success(output as PolicyOutput<S, P>) : { success: false }
  })

  return Object.assign(base, {
    pick<const K extends readonly (keyof S & string)[]>(keys: K) {
      const picked: Record<string, AnySchema> = {}
      for (const key of keys) {
        const schema = shape[key]
        if (!schema) throw new RangeError(`Unknown object schema key: ${key}`)
        setOwn(picked, key, schema)
      }
      return createObjectSchema(picked as Pick<S, K[number]>, policy)
    },
    omit<const K extends readonly (keyof S & string)[]>(keys: K) {
      const omitted = new Set<string>(keys)
      for (const key of keys) {
        if (!known.has(key)) throw new RangeError(`Unknown object schema key: ${key}`)
      }
      const remaining: Record<string, AnySchema> = {}
      for (const key of shapeKeys) {
        const schema = shape[key]
        if (schema && !omitted.has(key)) setOwn(remaining, key, schema)
      }
      return createObjectSchema(remaining as Omit<S, K[number]>, policy)
    },
    partial() {
      const partialShape: Record<string, AnySchema> = {}
      for (const key of shapeKeys) {
        const schema = shape[key]
        if (schema) setOwn(partialShape, key, schema.optional())
      }
      return createObjectSchema(partialShape as PartialShape<S>, policy)
    },
    extend<const E extends Shape>(extension: E) {
      const extended: Record<string, AnySchema> = {}
      for (const key of shapeKeys) {
        const schema = shape[key]
        if (schema) setOwn(extended, key, schema)
      }
      for (const key of Object.keys(extension)) {
        const schema = extension[key]
        if (schema) setOwn(extended, key, schema)
      }
      return createObjectSchema(extended as Omit<S, keyof E> & E, policy)
    },
    strip: () => createObjectSchema(shape, "strip"),
    strict: () => createObjectSchema(shape, "strict"),
    passthrough: () => createObjectSchema(shape, "passthrough"),
  })
}

/** Validates a plain object shape and strips unknown enumerable string keys by default. */
export const object = <const S extends Shape>(shape: S): ObjectSchema<S> =>
  createObjectSchema(shape, "strip")

/** Validates a fixed-length tuple and reports indexed element paths. */
export const tuple = <const S extends readonly AnySchema[]>(
  schemas: S,
): Schema<{ [K in keyof S]: InferOutput<S[K]> }, { [K in keyof S]: InferInput<S[K]> }> =>
  createSchema((input, path, context) => {
    if (!Array.isArray(input)) {
      return failure(context, path, "invalid_type", "Expected an array", {
        expected: "array",
        received: valueKind(input),
      })
    }
    if (input.length !== schemas.length) {
      return failure(
        context,
        path,
        "invalid_length",
        `Expected a tuple with ${schemas.length} items`,
        {
          details: { length: schemas.length },
        },
      )
    }

    const output: unknown[] = []
    let valid = true
    for (let index = 0; index < schemas.length && hasIssueCapacity(context); index += 1) {
      const schema = schemas[index]
      const result = schema
        ? internalSchema(schema)._run(input[index], [...path, index], context)
        : undefined
      if (!result) continue
      if (result.success) output[index] = result.data
      else valid = false
    }
    return valid ? success(output as { [K in keyof S]: InferOutput<S[K]> }) : { success: false }
  })

/** Validates every enumerable own string-keyed value in a plain object. */
export const record = <S extends AnySchema>(
  valueSchema: S,
): Schema<Record<string, InferOutput<S>>, Record<string, InferInput<S>>> =>
  createSchema((input, path, context) => {
    if (!isPlainObject(input)) {
      return failure(context, path, "invalid_type", "Expected a plain record", {
        expected: "plain object",
        received: valueKind(input),
      })
    }
    const output: Record<string, InferOutput<S>> = {}
    let valid = true
    for (const key of Object.keys(input)) {
      if (!hasIssueCapacity(context)) {
        valid = false
        break
      }
      const itemPath = [...path, key]
      const read = readOwn(input, key, itemPath, context)
      if (!read.success) {
        valid = false
        continue
      }
      const result = internalSchema(valueSchema)._run(read.value, itemPath, context)
      if (result.success) setOwn(output, key, result.data)
      else valid = false
    }
    return valid ? success(output) : { success: false }
  })

/** Tests alternatives independently and emits one issue when none succeeds. */
export const union = <const S extends readonly [AnySchema, AnySchema, ...AnySchema[]]>(
  schemas: S,
): Schema<InferOutput<S[number]>, InferInput<S[number]>> =>
  createSchema((input, path, context) => {
    for (const schema of schemas) {
      const candidate: ValidationContext = {
        issues: [],
        limit: context.limit - context.issues.length,
      }
      try {
        const result = internalSchema(schema)._run(input, path, candidate)
        if (result.success && candidate.issues.length === 0) {
          return success(result.data as InferOutput<S[number]>)
        }
      } catch {
        // Candidate exceptions stay isolated and are represented by the union failure below.
      }
    }
    return failure(context, path, "invalid_union", "Value did not match any union member")
  })
