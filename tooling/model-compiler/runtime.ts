import {
  type ArraySchema,
  type InferInput,
  type InferOutput,
  array as kernArray,
  boolean as kernBoolean,
  literal as kernLiteral,
  number as kernNumber,
  object as kernObject,
  string as kernString,
  type NumberSchema,
  type ObjectSchema,
  type ParseOptions,
  type SafeParseResult,
  type Schema,
  type SchemaPresence,
  type StringSchema,
} from "../../packages/kern/src/validation/index.js"

export interface ModelMetadata {
  readonly description?: string
  readonly example?: unknown
  readonly label?: string
}

export type StringOperation =
  | { readonly kind: "email"; readonly message: string }
  | { readonly kind: "endsWith"; readonly message: string; readonly value: string }
  | { readonly kind: "length"; readonly message: string; readonly value: number }
  | { readonly kind: "max"; readonly message: string; readonly value: number }
  | { readonly kind: "min"; readonly message: string; readonly value: number }
  | { readonly kind: "startsWith"; readonly message: string; readonly value: string }
  | { readonly kind: "trim" }
  | { readonly kind: "url"; readonly message: string }
  | { readonly kind: "uuid"; readonly message: string }

export type NumberOperation =
  | { readonly kind: "finite"; readonly message: string }
  | { readonly kind: "integer"; readonly message: string }
  | { readonly kind: "max"; readonly message: string; readonly value: number }
  | { readonly kind: "min"; readonly message: string; readonly value: number }
  | { readonly kind: "negative"; readonly message: string }
  | { readonly kind: "positive"; readonly message: string }
  | { readonly kind: "safeInteger"; readonly message: string }

export interface StringNode {
  readonly kind: "string"
  readonly metadata?: ModelMetadata
  readonly operations: readonly StringOperation[]
}

export interface NumberNode {
  readonly kind: "number"
  readonly metadata?: ModelMetadata
  readonly operations: readonly NumberOperation[]
}

export interface BooleanNode {
  readonly kind: "boolean"
  readonly metadata?: ModelMetadata
}

export interface LiteralNode {
  readonly kind: "literal"
  readonly metadata?: ModelMetadata
  readonly value: string | number | bigint | boolean | null | undefined
}

export interface ArrayNode {
  readonly element: ModelNode
  readonly kind: "array"
  readonly maxLength?: number
  readonly metadata?: ModelMetadata
  readonly minLength?: number
}

export interface ObjectNode {
  readonly fields: Readonly<Record<string, ModelNode>>
  readonly kind: "object"
  readonly metadata?: ModelMetadata
}

export interface OptionalNode {
  readonly inner: ModelNode
  readonly kind: "optional"
  readonly metadata?: ModelMetadata
}

export interface DefaultNode {
  readonly inner: ModelNode
  readonly kind: "default"
  readonly metadata?: ModelMetadata
  readonly value: unknown
}

export interface RefinementNode {
  readonly explanation: string
  readonly inner: ModelNode
  readonly kind: "refinement"
  readonly metadata?: ModelMetadata
}

export type ModelNode =
  | ArrayNode
  | BooleanNode
  | DefaultNode
  | LiteralNode
  | NumberNode
  | ObjectNode
  | OptionalNode
  | RefinementNode
  | StringNode

type LiteralValue = string | number | bigint | boolean | null | undefined

export interface ModelField<Output, Input = Output, Presence extends SchemaPresence = "required"> {
  readonly node: ModelNode
  readonly schema: Schema<Output, Input, Presence>
  check(
    predicate: (value: Output) => boolean,
    explanation?: string,
  ): ModelField<Output, Input, Presence>
  default(
    value: Exclude<Output, undefined>,
  ): ModelField<Exclude<Output, undefined>, Input | undefined, "defaulted">
  describe(metadata: ModelMetadata): ModelField<Output, Input, Presence>
  optional(): ModelField<Output | undefined, Input | undefined, "optional">
}

export interface ModelStringField extends ModelField<string> {
  email(message?: string): ModelStringField
  endsWith(value: string, message?: string): ModelStringField
  length(value: number, message?: string): ModelStringField
  max(value: number, message?: string): ModelStringField
  min(value: number, message?: string): ModelStringField
  startsWith(value: string, message?: string): ModelStringField
  trim(): ModelStringField
  url(message?: string): ModelStringField
  uuid(message?: string): ModelStringField
}

export interface ModelNumberField extends ModelField<number> {
  finite(message?: string): ModelNumberField
  integer(message?: string): ModelNumberField
  max(value: number, message?: string): ModelNumberField
  min(value: number, message?: string): ModelNumberField
  negative(message?: string): ModelNumberField
  positive(message?: string): ModelNumberField
  safeInteger(message?: string): ModelField<number>
}

export interface ModelArrayField<F extends AnyModelField>
  extends ModelField<InferOutput<F["schema"]>[], InferInput<F["schema"]>[]> {
  max(length: number, message?: string): ModelArrayField<F>
  min(length: number, message?: string): ModelArrayField<F>
}

export type AnyModelField = ModelField<unknown, unknown, SchemaPresence>
export type ModelShape = Readonly<Record<string, AnyModelField>>
type SchemaShape<S extends ModelShape> = { readonly [K in keyof S]: S[K]["schema"] }

export interface ModelDefinition<Name extends string = string, S extends ModelShape = ModelShape>
  extends ObjectSchema<SchemaShape<S>> {
  readonly modelName: Name
  readonly modelNode: ObjectNode
  readonly modelTag: "kern-model-experiment"
}

export type AnyModelDefinition = ModelDefinition<string, ModelShape>
export type ModelOutput<M extends AnyModelDefinition> = InferOutput<M>
export type ModelInput<M extends AnyModelDefinition> = InferInput<M>

const replaceMetadata = (node: ModelNode, metadata: ModelMetadata): ModelNode => ({
  ...node,
  metadata: { ...node.metadata, ...metadata },
})

const createBaseField = <Output, Input, Presence extends SchemaPresence>(
  node: ModelNode,
  schema: Schema<Output, Input, Presence>,
): ModelField<Output, Input, Presence> => ({
  node,
  schema,
  check(predicate, explanation = "Custom application check") {
    return createBaseField(
      { kind: "refinement", inner: node, explanation },
      schema.refine(predicate, explanation),
    )
  },
  default(value) {
    return createBaseField({ kind: "default", inner: node, value }, schema.default(value))
  },
  describe(metadata) {
    return createBaseField(replaceMetadata(node, metadata), schema)
  },
  optional() {
    return createBaseField({ kind: "optional", inner: node }, schema.optional())
  },
})

const createStringField = (
  schema: StringSchema = kernString(),
  operations: readonly StringOperation[] = [],
  metadata?: ModelMetadata,
): ModelStringField => {
  const node: StringNode = {
    kind: "string",
    operations,
    ...(metadata === undefined ? {} : { metadata }),
  }
  const base = createBaseField(node, schema)
  const append = (nextSchema: StringSchema, operation: StringOperation): ModelStringField =>
    createStringField(nextSchema, [...operations, operation], metadata)

  return Object.assign(base, {
    email(message = "Invalid email address") {
      return append(schema.email(message), { kind: "email", message })
    },
    endsWith(value: string, message = `Expected a string ending with ${value}`) {
      return append(schema.endsWith(value, message), { kind: "endsWith", value, message })
    },
    length(value: number, message = `Expected exactly ${value} characters`) {
      return append(schema.length(value, message), { kind: "length", value, message })
    },
    max(value: number, message = `Expected at most ${value} characters`) {
      return append(schema.max(value, message), { kind: "max", value, message })
    },
    min(value: number, message = `Expected at least ${value} characters`) {
      return append(schema.min(value, message), { kind: "min", value, message })
    },
    startsWith(value: string, message = `Expected a string starting with ${value}`) {
      return append(schema.startsWith(value, message), { kind: "startsWith", value, message })
    },
    trim() {
      return append(schema.trim(), { kind: "trim" })
    },
    url(message = "Invalid URL") {
      return append(schema.url(message), { kind: "url", message })
    },
    uuid(message = "Invalid UUID") {
      return append(schema.uuid(message), { kind: "uuid", message })
    },
  })
}

const safeIntegerSchema = (schema: NumberSchema, message: string): Schema<number> =>
  schema.refine(Number.isSafeInteger, { code: "not_safe_integer", message })

const createNumberField = (
  schema: Schema<number> = kernNumber(),
  operations: readonly NumberOperation[] = [],
  metadata?: ModelMetadata,
): ModelNumberField => {
  const node: NumberNode = {
    kind: "number",
    operations,
    ...(metadata === undefined ? {} : { metadata }),
  }
  const base = createBaseField(node, schema)
  const append = (nextSchema: Schema<number>, operation: NumberOperation): ModelNumberField =>
    createNumberField(nextSchema, [...operations, operation], metadata)

  return Object.assign(base, {
    finite(message = "Expected a finite number") {
      return append((schema as NumberSchema).finite(message), { kind: "finite", message })
    },
    integer(message = "Expected an integer") {
      return append((schema as NumberSchema).integer(message), { kind: "integer", message })
    },
    max(value: number, message = `Expected a number less than or equal to ${value}`) {
      return append((schema as NumberSchema).max(value, message), { kind: "max", value, message })
    },
    min(value: number, message = `Expected a number greater than or equal to ${value}`) {
      return append((schema as NumberSchema).min(value, message), { kind: "min", value, message })
    },
    negative(message = "Expected a negative number") {
      return append((schema as NumberSchema).negative(message), { kind: "negative", message })
    },
    positive(message = "Expected a positive number") {
      return append((schema as NumberSchema).positive(message), { kind: "positive", message })
    },
    safeInteger(message = "Expected a safe integer") {
      return append(safeIntegerSchema(schema as NumberSchema, message), {
        kind: "safeInteger",
        message,
      })
    },
  })
}

const createArrayField = <F extends AnyModelField>(
  element: F,
  schema: ArraySchema<F["schema"]> = kernArray(element.schema),
  bounds: { readonly maxLength?: number; readonly minLength?: number } = {},
): ModelArrayField<F> => {
  const node: ArrayNode = { kind: "array", element: element.node, ...bounds }
  const base = createBaseField(node, schema)
  return Object.assign(base, {
    max(length: number, message?: string) {
      return createArrayField(element, schema.max(length, message), {
        ...bounds,
        maxLength: length,
      })
    },
    min(length: number, message?: string) {
      return createArrayField(element, schema.min(length, message), {
        ...bounds,
        minLength: length,
      })
    },
  })
}

const createObjectField = <const S extends ModelShape>(
  shape: S,
): ModelField<
  InferOutput<ObjectSchema<SchemaShape<S>>>,
  InferInput<ObjectSchema<SchemaShape<S>>>
> => {
  const schemaShape = Object.create(null) as Record<
    string,
    Schema<unknown, unknown, SchemaPresence>
  >
  const nodes = Object.create(null) as Record<string, ModelNode>
  for (const key of Object.keys(shape)) {
    const member = shape[key]
    if (!member) continue
    schemaShape[key] = member.schema
    nodes[key] = member.node
  }
  const schema = kernObject(schemaShape as SchemaShape<S>)
  return createBaseField({ kind: "object", fields: nodes }, schema)
}

export const field = {
  array: <F extends AnyModelField>(element: F): ModelArrayField<F> => createArrayField(element),
  boolean: (): ModelField<boolean> => createBaseField({ kind: "boolean" }, kernBoolean()),
  literal: <const T extends LiteralValue>(value: T): ModelField<T> =>
    createBaseField({ kind: "literal", value }, kernLiteral(value)),
  number: (): ModelNumberField => createNumberField(),
  object: createObjectField,
  string: (): ModelStringField => createStringField(),
} as const

export const model = <const Name extends string, const S extends ModelShape>(
  name: Name,
  shape: S,
): ModelDefinition<Name, S> => {
  if (!/^[A-Z][A-Za-z0-9]*$/u.test(name)) {
    throw new TypeError("Model names must be PascalCase JavaScript identifiers")
  }
  const schemaShape = Object.create(null) as Record<
    string,
    Schema<unknown, unknown, SchemaPresence>
  >
  const nodes = Object.create(null) as Record<string, ModelNode>
  for (const key of Object.keys(shape)) {
    const member = shape[key]
    if (!member) continue
    schemaShape[key] = member.schema
    nodes[key] = member.node
  }
  const schema = kernObject(schemaShape as SchemaShape<S>)
  return Object.assign(schema, {
    modelName: name,
    modelNode: { kind: "object" as const, fields: nodes },
    modelTag: "kern-model-experiment" as const,
  }) as ModelDefinition<Name, S>
}

export const isModelDefinition = (value: unknown): value is AnyModelDefinition =>
  typeof value === "object" &&
  value !== null &&
  Reflect.get(value, "modelTag") === "kern-model-experiment"

export const COMPILED_FAILURE = Symbol("kern.model-compiler.failure")
export type CompiledResult<T> = T | typeof COMPILED_FAILURE
export type FastModelValidator<T> = (input: unknown) => CompiledResult<T>

export type CompiledModel<M extends AnyModelDefinition> = M & {
  readonly compiled: true
  readonly implementation: "generated-fast-path-with-kern-fallback"
}

export const createCompiledModel = <M extends AnyModelDefinition>(
  definition: M,
  fastValidator: FastModelValidator<ModelOutput<M>>,
): CompiledModel<M> => {
  const fallback = definition as unknown as Schema<ModelOutput<M>, ModelInput<M>>
  const safeParse = (input: unknown, options?: ParseOptions): SafeParseResult<ModelOutput<M>> => {
    if (options !== undefined) return fallback.safeParse(input, options)
    const fastResult = fastValidator(input)
    return fastResult === COMPILED_FAILURE
      ? fallback.safeParse(input)
      : { success: true, data: fastResult }
  }
  const parse = (input: unknown, options?: ParseOptions): ModelOutput<M> => {
    if (options !== undefined) return fallback.parse(input, options)
    const fastResult = fastValidator(input)
    return fastResult === COMPILED_FAILURE ? fallback.parse(input) : fastResult
  }

  return Object.assign({}, definition, {
    compiled: true as const,
    implementation: "generated-fast-path-with-kern-fallback" as const,
    parse,
    safeParse,
    "~standard": {
      version: 1 as const,
      vendor: "kern",
      validate(value: unknown) {
        const result = safeParse(value)
        return result.success ? { value: result.data } : { issues: result.issues }
      },
    },
  }) as CompiledModel<M>
}

export const fallbackFast = <M extends AnyModelDefinition>(
  definition: M,
  input: unknown,
): CompiledResult<ModelOutput<M>> => {
  const fallback = definition as unknown as Schema<ModelOutput<M>, ModelInput<M>>
  const result = fallback.safeParse(input)
  return result.success ? result.data : COMPILED_FAILURE
}

export const isPlainRecord = (input: unknown): input is Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false
  const prototype = Object.getPrototypeOf(input)
  return prototype === Object.prototype || prototype === null
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export const isEmail = (value: string): boolean => emailPattern.test(value)
export const isUuid = (value: string): boolean => uuidPattern.test(value)
export const isUrl = (value: string): boolean => URL.canParse(value)
