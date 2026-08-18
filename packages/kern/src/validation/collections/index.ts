import { createSchema, failure, rethrowFastException, validationException } from "../schema.js"
import {
  type AnySchema,
  FAILURE,
  type FastValidator,
  hasIssueCapacity,
  type InferInput,
  type InferOutput,
  type InternalSchema,
  type Schema,
  type SchemaPresence,
  type ValidationContext,
  valueKind,
} from "../types.js"

const internalSchema = <S extends AnySchema>(
  schema: S,
): InternalSchema<InferOutput<S>, InferInput<S>, SchemaPresence> =>
  schema as unknown as InternalSchema<InferOutput<S>, InferInput<S>, SchemaPresence>

/** Validates every array element and reports indexed paths. */
export const array = <S extends AnySchema>(element: S): Schema<InferOutput<S>[], InferInput<S>[]> =>
  createSchema(
    (input, context) => {
      if (!Array.isArray(input)) {
        return failure(context, "invalid_type", "Expected an array", {
          expected: "array",
          received: valueKind(input),
        })
      }

      context.path ??= []
      const path = context.path
      const output: InferOutput<S>[] = []
      let valid = true
      for (let index = 0; index < input.length && hasIssueCapacity(context); index += 1) {
        path.push(index)
        const result = internalSchema(element)._run(input[index], context)
        path.pop()
        if (result !== FAILURE) output.push(result as InferOutput<S>)
        else valid = false
      }
      return valid ? output : FAILURE
    },
    "required",
    (() => {
      const fast = internalSchema(element)._fast
      if (!fast) return undefined
      return (input: unknown) => {
        if (!Array.isArray(input)) return FAILURE
        const output = new Array<InferOutput<S>>(input.length)
        let index = 0
        try {
          for (; index < input.length; index += 1) {
            const result = fast(input[index])
            if (result === FAILURE) return FAILURE
            output[index] = result as InferOutput<S>
          }
        } catch (error) {
          rethrowFastException(error, index)
        }
        return output
      }
    })(),
  )

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

const isPlainObject = (input: unknown): input is Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false
  const prototype = Object.getPrototypeOf(input)
  return prototype === Object.prototype || prototype === null
}

const readOwn = (
  source: Record<string, unknown>,
  key: string,
  context: ValidationContext,
): unknown | typeof FAILURE => {
  try {
    return source[key]
  } catch {
    validationException(context)
    return FAILURE
  }
}

const createObjectSchema = <const S extends Shape, P extends UnknownKeyPolicy>(
  shape: S,
  policy: P,
): ObjectSchema<S, P> => {
  const snapshot = { ...shape } as Record<string, AnySchema>
  const shapeKeys = Object.keys(snapshot)
  let cachedFields: ReadonlyArray<InternalSchema<unknown, unknown, SchemaPresence>> | undefined
  const getFields = (): ReadonlyArray<InternalSchema<unknown, unknown, SchemaPresence>> =>
    (cachedFields ??= shapeKeys.map((key) => internalSchema(snapshot[key] as AnySchema)))
  let known: Set<string> | undefined
  const knownKeys = (): Set<string> => (known ??= new Set(shapeKeys))
  const validator = (input: unknown, context: ValidationContext) => {
    if (!isPlainObject(input)) {
      return failure(context, "invalid_type", "Expected a plain object", {
        expected: "plain object",
        received: valueKind(input),
      })
    }

    context.path ??= []
    const path = context.path
    const output = Object.create(null) as Record<string, unknown>
    let valid = true

    const fields = getFields()
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      if (!hasIssueCapacity(context)) {
        valid = false
        break
      }
      const propertyInternal = fields[fieldIndex] as InternalSchema<
        unknown,
        unknown,
        SchemaPresence
      >
      const key = shapeKeys[fieldIndex] as string
      const presence = propertyInternal._presence
      path.push(key)
      const hasProperty = Object.hasOwn(input, key)
      if (!hasProperty && presence === "required") {
        failure(context, "required", "Required property", {
          expected: "defined property",
          received: "undefined",
        })
        valid = false
        path.pop()
        continue
      }

      let propertyValue: unknown
      if (hasProperty) {
        const read = readOwn(input, key, context)
        if (read === FAILURE) {
          valid = false
          path.pop()
          continue
        }
        propertyValue = read
      }

      const result = propertyInternal._run(propertyValue, context)
      if (result === FAILURE) {
        valid = false
      } else if (presence !== "optional" || result !== undefined) {
        output[key] = result
      }
      path.pop()
    }

    if (policy !== "strip") {
      for (const key of Object.keys(input)) {
        if (!hasIssueCapacity(context)) {
          valid = false
          break
        }
        if (knownKeys().has(key)) continue
        path.push(key)
        if (policy === "strict") {
          failure(context, "unrecognized_key", "Unrecognized key", {
            details: { key },
          })
          valid = false
          path.pop()
          continue
        }

        const read = readOwn(input, key, context)
        if (read === FAILURE) {
          valid = false
          path.pop()
          continue
        }
        output[key] = read
        path.pop()
      }
    }

    if (!valid) return FAILURE
    Object.setPrototypeOf(output, Object.prototype)
    return output as PolicyOutput<S, P>
  }
  const initializeFast = () => {
    const fields = getFields()
    const literalFastValidator = (() => {
      if (policy !== "strip" || fields.some((field) => field._presence !== "required")) {
        return undefined
      }
      if (fields.length === 1) {
        const first = fields[0]
        const firstKey = shapeKeys[0]
        const firstFast = first?._fast
        if (!firstKey || !firstFast) return undefined
        return (input: unknown) => {
          if (!isPlainObject(input)) return FAILURE
          try {
            if (!Object.hasOwn(input, firstKey)) return FAILURE
            const firstResult = firstFast(input[firstKey])
            return firstResult === FAILURE
              ? FAILURE
              : ({ [firstKey]: firstResult } as PolicyOutput<S, P>)
          } catch (error) {
            rethrowFastException(error, firstKey)
          }
        }
      }
      if (fields.length === 2) {
        const first = fields[0]
        const second = fields[1]
        const firstKey = shapeKeys[0]
        const secondKey = shapeKeys[1]
        const firstFast = first?._fast
        const secondFast = second?._fast
        if (!firstKey || !secondKey || !firstFast || !secondFast) return undefined
        return (input: unknown) => {
          if (!isPlainObject(input)) return FAILURE
          let key = firstKey
          try {
            if (!Object.hasOwn(input, key)) return FAILURE
            const firstResult = firstFast(input[key])
            if (firstResult === FAILURE) return FAILURE
            key = secondKey
            if (!Object.hasOwn(input, key)) return FAILURE
            const secondResult = secondFast(input[key])
            return secondResult === FAILURE
              ? FAILURE
              : ({ [firstKey]: firstResult, [secondKey]: secondResult } as PolicyOutput<S, P>)
          } catch (error) {
            rethrowFastException(error, key)
          }
        }
      }
      if (fields.length === 3) {
        const first = fields[0]
        const second = fields[1]
        const third = fields[2]
        const firstKey = shapeKeys[0]
        const secondKey = shapeKeys[1]
        const thirdKey = shapeKeys[2]
        const firstFast = first?._fast
        const secondFast = second?._fast
        const thirdFast = third?._fast
        if (!firstKey || !secondKey || !thirdKey || !firstFast || !secondFast || !thirdFast) {
          return undefined
        }
        return (input: unknown) => {
          if (!isPlainObject(input)) return FAILURE
          let key = firstKey
          try {
            if (!Object.hasOwn(input, key)) return FAILURE
            const firstResult = firstFast(input[key])
            if (firstResult === FAILURE) return FAILURE
            key = secondKey
            if (!Object.hasOwn(input, key)) return FAILURE
            const secondResult = secondFast(input[key])
            if (secondResult === FAILURE) return FAILURE
            key = thirdKey
            if (!Object.hasOwn(input, key)) return FAILURE
            const thirdResult = thirdFast(input[key])
            return thirdResult === FAILURE
              ? FAILURE
              : ({
                  [firstKey]: firstResult,
                  [secondKey]: secondResult,
                  [thirdKey]: thirdResult,
                } as PolicyOutput<S, P>)
          } catch (error) {
            rethrowFastException(error, key)
          }
        }
      }
      return undefined
    })()
    const genericFastValidator =
      literalFastValidator === undefined
        ? (input: unknown) => {
            if (!isPlainObject(input)) return FAILURE
            const output = Object.create(null) as Record<string, unknown>
            let key = ""
            try {
              for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
                const field = fields[fieldIndex] as InternalSchema<unknown, unknown, SchemaPresence>
                key = shapeKeys[fieldIndex] as string
                const hasProperty = Object.hasOwn(input, key)
                if (!hasProperty && field._presence === "required") return FAILURE
                const result = field._fast?.(hasProperty ? input[key] : undefined)
                if (result === FAILURE) return FAILURE
                if (field._presence !== "optional" || result !== undefined) output[key] = result
              }
              if (policy !== "strip") {
                for (key of Object.keys(input)) {
                  if (knownKeys().has(key)) continue
                  if (policy === "strict") return FAILURE
                  output[key] = input[key]
                }
              }
            } catch (error) {
              rethrowFastException(error, key)
            }
            Object.setPrototypeOf(output, Object.prototype)
            return output as PolicyOutput<S, P>
          }
        : undefined
    const compiledFastValidator = (literalFastValidator ?? genericFastValidator) as
      | FastValidator<PolicyOutput<S, P>>
      | undefined
    const compiledFastSafeParse = (() => {
      if (
        policy !== "strip" ||
        fields.length !== 3 ||
        fields.some((field) => field._presence !== "required")
      ) {
        return undefined
      }
      const first = fields[0]
      const second = fields[1]
      const third = fields[2]
      const firstKey = shapeKeys[0]
      const secondKey = shapeKeys[1]
      const thirdKey = shapeKeys[2]
      const firstFast = first?._fast
      const secondFast = second?._fast
      const thirdFast = third?._fast
      if (
        !first ||
        !second ||
        !third ||
        !firstKey ||
        !secondKey ||
        !thirdKey ||
        !firstFast ||
        !secondFast ||
        !thirdFast
      ) {
        return undefined
      }

      return (input: unknown) => {
        if (!isPlainObject(input)) {
          const context: ValidationContext = {
            issues: [],
            limit: Number.POSITIVE_INFINITY,
            path: undefined,
          }
          validator(input, context)
          return { success: false as const, issues: context.issues }
        }

        let key = firstKey
        try {
          const hasFirst = Object.hasOwn(input, key)
          const firstValue = hasFirst ? input[key] : undefined
          const firstResult = hasFirst ? firstFast(firstValue) : FAILURE
          key = secondKey
          const hasSecond = Object.hasOwn(input, key)
          const secondValue = hasSecond ? input[key] : undefined
          const secondResult = hasSecond ? secondFast(secondValue) : FAILURE
          key = thirdKey
          const hasThird = Object.hasOwn(input, key)
          const thirdValue = hasThird ? input[key] : undefined
          const thirdResult = hasThird ? thirdFast(thirdValue) : FAILURE

          if (firstResult !== FAILURE && secondResult !== FAILURE && thirdResult !== FAILURE) {
            return {
              success: true as const,
              data: {
                [firstKey]: firstResult,
                [secondKey]: secondResult,
                [thirdKey]: thirdResult,
              } as PolicyOutput<S, P>,
            }
          }

          const context: ValidationContext = {
            issues: [],
            limit: Number.POSITIVE_INFINITY,
            path: [],
          }
          const path = context.path as string[]
          const report = (
            field: InternalSchema<unknown, unknown, SchemaPresence>,
            fieldKey: string,
            hasProperty: boolean,
            fieldValue: unknown,
            result: unknown,
          ): void => {
            if (result !== FAILURE) return
            path[0] = fieldKey
            path.length = 1
            if (hasProperty) field._run(fieldValue, context)
            else {
              failure(context, "required", "Required property", {
                expected: "defined property",
                received: "undefined",
              })
            }
          }
          report(first, firstKey, hasFirst, firstValue, firstResult)
          report(second, secondKey, hasSecond, secondValue, secondResult)
          report(third, thirdKey, hasThird, thirdValue, thirdResult)
          path.length = 0
          return { success: false as const, issues: context.issues }
        } catch (error) {
          rethrowFastException(error, key)
        }
      }
    })()
    return { compiledFastSafeParse, compiledFastValidator }
  }
  let initializedFast: ReturnType<typeof initializeFast> | undefined
  let supportsFast = true
  let supportsFastSafeParse = policy === "strip" && shapeKeys.length === 3
  for (const key of shapeKeys) {
    const field = internalSchema(snapshot[key] as AnySchema)
    if (field._fast === undefined) supportsFast = false
    if (field._presence !== "required" || field._fast === undefined) {
      supportsFastSafeParse = false
    }
  }
  const fastValidator: FastValidator<PolicyOutput<S, P>> | undefined = supportsFast
    ? (input) => {
        initializedFast ??= initializeFast()
        return initializedFast.compiledFastValidator?.(input) ?? FAILURE
      }
    : undefined
  const fastSafeParse = supportsFastSafeParse
    ? (input: unknown) => {
        initializedFast ??= initializeFast()
        const parser = initializedFast.compiledFastSafeParse
        if (!parser) throw new Error("Fast safe parser was not initialized")
        return parser(input)
      }
    : undefined
  const base = createSchema<PolicyOutput<S, P>, ObjectInput<S>>(
    validator,
    "required",
    fastValidator,
    fastSafeParse,
  )

  return Object.assign(base, {
    pick<const K extends readonly (keyof S & string)[]>(keys: K) {
      const picked = Object.create(null) as Record<string, AnySchema>
      for (const key of keys) {
        const schema = snapshot[key]
        if (!schema) throw new RangeError(`Unknown object schema key: ${key}`)
        picked[key] = schema
      }
      return createObjectSchema(picked as Pick<S, K[number]>, policy)
    },
    omit<const K extends readonly (keyof S & string)[]>(keys: K) {
      const omitted = new Set<string>(keys)
      for (const key of keys) {
        if (!knownKeys().has(key)) throw new RangeError(`Unknown object schema key: ${key}`)
      }
      const remaining = Object.create(null) as Record<string, AnySchema>
      for (const key of shapeKeys) {
        const schema = snapshot[key]
        if (schema && !omitted.has(key)) remaining[key] = schema
      }
      return createObjectSchema(remaining as Omit<S, K[number]>, policy)
    },
    partial() {
      const partialShape = Object.create(null) as Record<string, AnySchema>
      for (const key of shapeKeys) {
        const schema = snapshot[key]
        if (schema) partialShape[key] = schema.optional()
      }
      return createObjectSchema(partialShape as PartialShape<S>, policy)
    },
    extend<const E extends Shape>(extension: E) {
      const extended = Object.create(null) as Record<string, AnySchema>
      for (const key of shapeKeys) {
        const schema = snapshot[key]
        if (schema) extended[key] = schema
      }
      for (const key of Object.keys(extension)) {
        const schema = extension[key]
        if (schema) extended[key] = schema
      }
      return createObjectSchema(extended as Omit<S, keyof E> & E, policy)
    },
    strip: () => createObjectSchema(snapshot as S, "strip"),
    strict: () => createObjectSchema(snapshot as S, "strict"),
    passthrough: () => createObjectSchema(snapshot as S, "passthrough"),
  })
}

/** Validates a plain object shape and strips unknown enumerable string keys by default. */
export const object = <const S extends Shape>(shape: S): ObjectSchema<S> =>
  createObjectSchema(shape, "strip")

/** Validates a fixed-length tuple and reports indexed element paths. */
export const tuple = <const S extends readonly AnySchema[]>(
  schemas: S,
): Schema<{ [K in keyof S]: InferOutput<S[K]> }, { [K in keyof S]: InferInput<S[K]> }> =>
  createSchema((input, context) => {
    if (!Array.isArray(input)) {
      return failure(context, "invalid_type", "Expected an array", {
        expected: "array",
        received: valueKind(input),
      })
    }
    if (input.length !== schemas.length) {
      return failure(context, "invalid_length", `Expected a tuple with ${schemas.length} items`, {
        details: { length: schemas.length },
      })
    }

    context.path ??= []
    const path = context.path
    const output: unknown[] = []
    let valid = true
    for (let index = 0; index < schemas.length && hasIssueCapacity(context); index += 1) {
      const schema = schemas[index]
      if (!schema) continue
      path.push(index)
      const result = internalSchema(schema)._run(input[index], context)
      path.pop()
      if (result !== FAILURE) output[index] = result
      else valid = false
    }
    return valid ? (output as { [K in keyof S]: InferOutput<S[K]> }) : FAILURE
  })

/** Validates every enumerable own string-keyed value in a plain object. */
export const record = <S extends AnySchema>(
  valueSchema: S,
): Schema<Record<string, InferOutput<S>>, Record<string, InferInput<S>>> =>
  createSchema((input, context) => {
    if (!isPlainObject(input)) {
      return failure(context, "invalid_type", "Expected a plain record", {
        expected: "plain object",
        received: valueKind(input),
      })
    }
    context.path ??= []
    const path = context.path
    const output = Object.create(null) as Record<string, InferOutput<S>>
    let valid = true
    for (const key of Object.keys(input)) {
      if (!hasIssueCapacity(context)) {
        valid = false
        break
      }
      path.push(key)
      const read = readOwn(input, key, context)
      if (read === FAILURE) {
        valid = false
        path.pop()
        continue
      }
      const result = internalSchema(valueSchema)._run(read, context)
      if (result !== FAILURE) output[key] = result
      else valid = false
      path.pop()
    }
    if (!valid) return FAILURE
    Object.setPrototypeOf(output, Object.prototype)
    return output
  })

/** Tests alternatives independently and emits one issue when none succeeds. */
export const union = <const S extends readonly [AnySchema, AnySchema, ...AnySchema[]]>(
  schemas: S,
): Schema<InferOutput<S[number]>, InferInput<S[number]>> =>
  createSchema((input, context) => {
    for (const schema of schemas) {
      const candidate: ValidationContext = {
        issues: [],
        limit: context.limit - context.issues.length,
        path: context.path?.slice(),
      }
      try {
        const result = internalSchema(schema)._run(input, candidate)
        if (result !== FAILURE && candidate.issues.length === 0) {
          return result as InferOutput<S[number]>
        }
      } catch {
        // Candidate exceptions stay isolated and are represented by the union failure below.
      }
    }
    return failure(context, "invalid_union", "Value did not match any union member")
  })
