import type {
  AnyModelDefinition,
  ArrayNode,
  ModelMetadata,
  ModelNode,
  NumberNode,
  ObjectNode,
  StringNode,
} from "./runtime.js"
import { isModelDefinition } from "./runtime.js"

export interface ModelCompilationReport {
  readonly exportName: string
  readonly mode: "compiled" | "runtime-fallback"
  readonly modelName: string
  readonly notices: readonly string[]
}

export interface CompiledArtifacts {
  readonly examples: Readonly<Record<string, unknown>>
  readonly forms: Readonly<Record<string, unknown>>
  readonly jsonSchema: Readonly<Record<string, unknown>>
  readonly modelSources: Readonly<Record<string, string>>
  readonly openapi: Readonly<Record<string, unknown>>
  readonly registrySource: string
  readonly report: readonly ModelCompilationReport[]
  readonly validatorDeclarations: Readonly<Record<string, string>>
  readonly validatorSources: Readonly<Record<string, string>>
}

export interface CompilerOptions {
  readonly runtimeImport: string
  readonly sourceImport: string
  readonly sourceImports?: Readonly<Record<string, string>>
}

interface EmitContext {
  counter: number
  readonly lines: string[]
}

interface DiscoveredModel {
  readonly definition: AnyModelDefinition
  readonly exportName: string
}

const indent = (depth: number): string => "  ".repeat(depth)
const quoted = (value: string): string => JSON.stringify(value)

const sourceLiteral = (value: unknown): string => {
  if (value === undefined) return "undefined"
  if (typeof value === "bigint") return `${value}n`
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "Number.NaN"
    if (value === Number.POSITIVE_INFINITY) return "Number.POSITIVE_INFINITY"
    if (value === Number.NEGATIVE_INFINITY) return "Number.NEGATIVE_INFINITY"
    if (Object.is(value, -0)) return "-0"
  }
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new TypeError("Model defaults must be serializable")
  return serialized
}

const nextVariable = (context: EmitContext, label: string): string => {
  const variable = `${label}${context.counter}`
  context.counter += 1
  return variable
}

const add = (context: EmitContext, depth: number, line: string): void => {
  context.lines.push(`${indent(depth)}${line}`)
}

const presenceOf = (node: ModelNode): "defaulted" | "optional" | "required" => {
  if (node.kind === "optional") return "optional"
  if (node.kind === "default") return "defaulted"
  if (node.kind === "refinement") return presenceOf(node.inner)
  return "required"
}

const containsRefinement = (node: ModelNode): boolean => {
  if (node.kind === "refinement") return true
  if (node.kind === "array" || node.kind === "default" || node.kind === "optional") {
    return containsRefinement(node.kind === "array" ? node.element : node.inner)
  }
  if (node.kind === "object") return Object.values(node.fields).some(containsRefinement)
  return false
}

const emitString = (
  node: StringNode,
  expression: string,
  context: EmitContext,
  depth: number,
): string => {
  const value = nextVariable(context, "stringValue")
  add(context, depth, `let ${value} = ${expression}`)
  add(context, depth, `if (typeof ${value} !== "string") return COMPILED_FAILURE`)
  for (const operation of node.operations) {
    switch (operation.kind) {
      case "trim":
        add(context, depth, `${value} = ${value}.trim()`)
        break
      case "min":
        add(context, depth, `if (${value}.length < ${operation.value}) return COMPILED_FAILURE`)
        break
      case "max":
        add(context, depth, `if (${value}.length > ${operation.value}) return COMPILED_FAILURE`)
        break
      case "length":
        add(context, depth, `if (${value}.length !== ${operation.value}) return COMPILED_FAILURE`)
        break
      case "email":
        add(context, depth, `if (!isEmail(${value})) return COMPILED_FAILURE`)
        break
      case "url":
        add(context, depth, `if (!isUrl(${value})) return COMPILED_FAILURE`)
        break
      case "uuid":
        add(context, depth, `if (!isUuid(${value})) return COMPILED_FAILURE`)
        break
      case "startsWith":
        add(
          context,
          depth,
          `if (!${value}.startsWith(${quoted(operation.value)})) return COMPILED_FAILURE`,
        )
        break
      case "endsWith":
        add(
          context,
          depth,
          `if (!${value}.endsWith(${quoted(operation.value)})) return COMPILED_FAILURE`,
        )
        break
    }
  }
  return value
}

const emitNumber = (
  node: NumberNode,
  expression: string,
  context: EmitContext,
  depth: number,
): string => {
  const value = nextVariable(context, "numberValue")
  add(context, depth, `const ${value} = ${expression}`)
  add(
    context,
    depth,
    `if (typeof ${value} !== "number" || Number.isNaN(${value})) return COMPILED_FAILURE`,
  )
  for (const operation of node.operations) {
    switch (operation.kind) {
      case "integer":
        add(context, depth, `if (!Number.isInteger(${value})) return COMPILED_FAILURE`)
        break
      case "safeInteger":
        add(context, depth, `if (!Number.isSafeInteger(${value})) return COMPILED_FAILURE`)
        break
      case "finite":
        add(context, depth, `if (!Number.isFinite(${value})) return COMPILED_FAILURE`)
        break
      case "min":
        add(
          context,
          depth,
          `if (${value} < ${sourceLiteral(operation.value)}) return COMPILED_FAILURE`,
        )
        break
      case "max":
        add(
          context,
          depth,
          `if (${value} > ${sourceLiteral(operation.value)}) return COMPILED_FAILURE`,
        )
        break
      case "positive":
        add(context, depth, `if (${value} <= 0) return COMPILED_FAILURE`)
        break
      case "negative":
        add(context, depth, `if (${value} >= 0) return COMPILED_FAILURE`)
        break
    }
  }
  return value
}

const emitArray = (
  node: ArrayNode,
  expression: string,
  context: EmitContext,
  depth: number,
): string => {
  const input = nextVariable(context, "arrayValue")
  const output = nextVariable(context, "arrayOutput")
  const index = nextVariable(context, "index")
  add(context, depth, `const ${input} = ${expression}`)
  add(context, depth, `if (!Array.isArray(${input})) return COMPILED_FAILURE`)
  if (node.minLength !== undefined) {
    add(context, depth, `if (${input}.length < ${node.minLength}) return COMPILED_FAILURE`)
  }
  if (node.maxLength !== undefined) {
    add(context, depth, `if (${input}.length > ${node.maxLength}) return COMPILED_FAILURE`)
  }
  add(context, depth, `const ${output} = new Array(${input}.length)`)
  add(context, depth, `for (let ${index} = 0; ${index} < ${input}.length; ${index} += 1) {`)
  const element = emitNode(node.element, `${input}[${index}]`, context, depth + 1)
  add(context, depth + 1, `${output}[${index}] = ${element}`)
  add(context, depth, "}")
  return output
}

const emitObject = (
  node: ObjectNode,
  expression: string,
  context: EmitContext,
  depth: number,
): string => {
  const input = nextVariable(context, "objectValue")
  const output = nextVariable(context, "objectOutput")
  add(context, depth, `const ${input} = ${expression}`)
  add(context, depth, `if (!isPlainRecord(${input})) return COMPILED_FAILURE`)
  add(context, depth, `const ${output} = {}`)

  for (const [key, child] of Object.entries(node.fields)) {
    const hasProperty = nextVariable(context, "hasProperty")
    const presence = presenceOf(child)
    add(context, depth, `const ${hasProperty} = Object.hasOwn(${input}, ${quoted(key)})`)
    if (presence === "required") {
      add(context, depth, `if (!${hasProperty}) return COMPILED_FAILURE`)
    }
    const childValue = emitNode(
      child,
      `${hasProperty} ? ${input}[${quoted(key)}] : undefined`,
      context,
      depth,
    )
    if (presence === "optional") {
      add(
        context,
        depth,
        `if (${hasProperty} && ${childValue} !== undefined) ${output}[${quoted(key)}] = ${childValue}`,
      )
    } else {
      add(context, depth, `${output}[${quoted(key)}] = ${childValue}`)
    }
  }
  return output
}

const emitNode = (
  node: ModelNode,
  expression: string,
  context: EmitContext,
  depth: number,
): string => {
  switch (node.kind) {
    case "string":
      return emitString(node, expression, context, depth)
    case "number":
      return emitNumber(node, expression, context, depth)
    case "boolean": {
      const value = nextVariable(context, "booleanValue")
      add(context, depth, `const ${value} = ${expression}`)
      add(context, depth, `if (typeof ${value} !== "boolean") return COMPILED_FAILURE`)
      return value
    }
    case "literal": {
      const value = nextVariable(context, "literalValue")
      add(context, depth, `const ${value} = ${expression}`)
      add(
        context,
        depth,
        `if (!Object.is(${value}, ${sourceLiteral(node.value)})) return COMPILED_FAILURE`,
      )
      return value
    }
    case "array":
      return emitArray(node, expression, context, depth)
    case "object":
      return emitObject(node, expression, context, depth)
    case "optional": {
      const input = nextVariable(context, "optionalInput")
      const output = nextVariable(context, "optionalOutput")
      add(context, depth, `const ${input} = ${expression}`)
      add(context, depth, `let ${output}`)
      add(context, depth, `if (${input} === undefined) {`)
      add(context, depth + 1, `${output} = undefined`)
      add(context, depth, "} else {")
      const inner = emitNode(node.inner, input, context, depth + 1)
      add(context, depth + 1, `${output} = ${inner}`)
      add(context, depth, "}")
      return output
    }
    case "default": {
      const input = nextVariable(context, "defaultInput")
      const output = nextVariable(context, "defaultOutput")
      add(context, depth, `const ${input} = ${expression}`)
      add(context, depth, `let ${output}`)
      add(context, depth, `if (${input} === undefined) {`)
      add(context, depth + 1, `${output} = ${sourceLiteral(node.value)}`)
      add(context, depth, "} else {")
      const inner = emitNode(node.inner, input, context, depth + 1)
      add(context, depth + 1, `${output} = ${inner}`)
      add(context, depth, "}")
      return output
    }
    case "refinement":
      throw new Error("Refinements must use the runtime fallback")
  }
}

const emitFastValidator = (model: DiscoveredModel): string => {
  const definition = `${model.exportName}Definition`
  const validator = `${model.exportName}Fast`
  if (containsRefinement(model.definition.modelNode)) {
    return `const ${validator} = (input) => fallbackFast(${definition}, input)`
  }

  const context: EmitContext = { counter: 0, lines: [] }
  add(context, 0, `const ${validator} = (input) => {`)
  add(context, 1, "try {")
  const result = emitNode(model.definition.modelNode, "input", context, 2)
  add(context, 2, `return ${result}`)
  add(context, 1, "} catch {")
  add(context, 2, "return COMPILED_FAILURE")
  add(context, 1, "}")
  add(context, 0, "}")
  return context.lines.join("\n")
}

const discoverModels = (exports: Readonly<Record<string, unknown>>): DiscoveredModel[] => {
  const discovered = Object.entries(exports)
    .filter((entry): entry is [string, AnyModelDefinition] => isModelDefinition(entry[1]))
    .map(([exportName, definition]) => ({ exportName, definition }))
    .sort((left, right) => left.exportName.localeCompare(right.exportName))
  if (discovered.length === 0) throw new TypeError("No Kern models were found")

  const names = new Set<string>()
  for (const candidate of discovered) {
    if (!/^[A-Z][A-Za-z0-9]*$/u.test(candidate.exportName)) {
      throw new TypeError(`Model export ${candidate.exportName} must be a PascalCase identifier`)
    }
    if (candidate.definition.modelName !== candidate.exportName) {
      throw new TypeError(
        `Model ${candidate.exportName} must use the same name in model("${candidate.exportName}", ...)`,
      )
    }
    if (names.has(candidate.definition.modelName)) {
      throw new TypeError(`Duplicate model name: ${candidate.definition.modelName}`)
    }
    names.add(candidate.definition.modelName)
  }
  return discovered
}

const metadataSchema = (metadata: ModelMetadata | undefined): Record<string, unknown> => ({
  ...(metadata?.description === undefined ? {} : { description: metadata.description }),
  ...(metadata?.label === undefined ? {} : { title: metadata.label }),
  ...(metadata?.example === undefined ? {} : { examples: [metadata.example] }),
})

const escapePattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")

const jsonSchemaFor = (
  node: ModelNode,
  path: string,
  notices: string[],
): Record<string, unknown> => {
  const metadata = metadataSchema(node.metadata)
  switch (node.kind) {
    case "optional":
      return jsonSchemaFor(node.inner, path, notices)
    case "default":
      return { ...jsonSchemaFor(node.inner, path, notices), default: node.value }
    case "refinement":
      notices.push(
        `${path} uses a custom application check. Runtime validation keeps it; JSON Schema and OpenAPI describe only its built-in rules.`,
      )
      return jsonSchemaFor(node.inner, path, notices)
    case "string": {
      const schema: Record<string, unknown> = { type: "string", ...metadata }
      const patterns: string[] = []
      for (const operation of node.operations) {
        if (operation.kind === "min") schema.minLength = operation.value
        else if (operation.kind === "max") schema.maxLength = operation.value
        else if (operation.kind === "length") {
          schema.minLength = operation.value
          schema.maxLength = operation.value
        } else if (operation.kind === "email") schema.format = "email"
        else if (operation.kind === "url") schema.format = "uri"
        else if (operation.kind === "uuid") schema.format = "uuid"
        else if (operation.kind === "startsWith") {
          patterns.push(`^${escapePattern(operation.value)}`)
        } else if (operation.kind === "endsWith") {
          patterns.push(`${escapePattern(operation.value)}$`)
        } else if (operation.kind === "trim") {
          notices.push(
            `${path} is trimmed by Kern at runtime. JSON Schema and OpenAPI can describe the string but cannot transform it.`,
          )
        }
      }
      if (patterns.length === 1) schema.pattern = patterns[0]
      else if (patterns.length > 1) schema.allOf = patterns.map((pattern) => ({ pattern }))
      return schema
    }
    case "number": {
      const schema: Record<string, unknown> = { type: "number", ...metadata }
      for (const operation of node.operations) {
        if (operation.kind === "integer" || operation.kind === "safeInteger") {
          schema.type = "integer"
        } else if (operation.kind === "min") schema.minimum = operation.value
        else if (operation.kind === "max") schema.maximum = operation.value
        else if (operation.kind === "positive") schema.exclusiveMinimum = 0
        else if (operation.kind === "negative") schema.exclusiveMaximum = 0
      }
      return schema
    }
    case "boolean":
      return { type: "boolean", ...metadata }
    case "literal":
      return { const: node.value, ...metadata }
    case "array":
      return {
        type: "array",
        items: jsonSchemaFor(node.element, `${path}[]`, notices),
        ...(node.minLength === undefined ? {} : { minItems: node.minLength }),
        ...(node.maxLength === undefined ? {} : { maxItems: node.maxLength }),
        ...metadata,
      }
    case "object": {
      const properties = Object.create(null) as Record<string, unknown>
      const required: string[] = []
      for (const [key, child] of Object.entries(node.fields)) {
        properties[key] = jsonSchemaFor(child, `${path}.${key}`, notices)
        if (presenceOf(child) === "required") required.push(key)
      }
      return {
        type: "object",
        additionalProperties: false,
        properties,
        ...(required.length === 0 ? {} : { required }),
        ...metadata,
      }
    }
  }
}

const humanize = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/[_-]+/gu, " ")
    .replace(/^./u, (character) => character.toUpperCase())

const formFor = (node: ModelNode, key: string): Record<string, unknown> => {
  if (node.kind === "optional" || node.kind === "default" || node.kind === "refinement") {
    return {
      ...formFor(node.inner, key),
      required: presenceOf(node) === "required",
      ...(node.kind === "default" ? { default: node.value } : {}),
    }
  }
  const common = {
    label: node.metadata?.label ?? humanize(key),
    ...(node.metadata?.description === undefined ? {} : { description: node.metadata.description }),
    required: true,
  }
  if (node.kind === "string") {
    const field: Record<string, unknown> = { control: "text", ...common }
    for (const operation of node.operations) {
      if (operation.kind === "email") field.control = "email"
      else if (operation.kind === "url") field.control = "url"
      else if (operation.kind === "min") field.minLength = operation.value
      else if (operation.kind === "max") field.maxLength = operation.value
      else if (operation.kind === "length") {
        field.minLength = operation.value
        field.maxLength = operation.value
      }
    }
    return field
  }
  if (node.kind === "number") {
    const result: Record<string, unknown> = { control: "number", ...common }
    for (const operation of node.operations) {
      if (operation.kind === "min") result.minimum = operation.value
      else if (operation.kind === "max") result.maximum = operation.value
      else if (operation.kind === "integer" || operation.kind === "safeInteger") result.step = 1
    }
    return result
  }
  if (node.kind === "boolean") return { control: "checkbox", ...common }
  if (node.kind === "literal") return { control: "constant", value: node.value, ...common }
  if (node.kind === "array") {
    return { control: "list", item: formFor(node.element, "Item"), ...common }
  }
  const fields = Object.create(null) as Record<string, unknown>
  for (const [childKey, child] of Object.entries(node.fields)) {
    fields[childKey] = formFor(child, childKey)
  }
  return { control: "group", fields, ...common }
}

const exampleFor = (node: ModelNode): unknown => {
  if (node.metadata && "example" in node.metadata) return node.metadata.example
  if (node.kind === "optional") return undefined
  if (node.kind === "default") return node.value
  if (node.kind === "refinement") return exampleFor(node.inner)
  if (node.kind === "boolean") return false
  if (node.kind === "literal") return node.value
  if (node.kind === "number") {
    let value = 1
    for (const operation of node.operations) {
      if (operation.kind === "min") value = Math.max(value, operation.value)
      else if (operation.kind === "max") value = Math.min(value, operation.value)
      else if (operation.kind === "negative") value = -1
      else if (operation.kind === "positive") value = 1
    }
    return node.operations.some(
      (operation) => operation.kind === "integer" || operation.kind === "safeInteger",
    )
      ? Math.trunc(value)
      : value
  }
  if (node.kind === "string") {
    if (node.operations.some((operation) => operation.kind === "email")) {
      return "person@example.com"
    }
    if (node.operations.some((operation) => operation.kind === "url")) {
      return "https://example.com"
    }
    if (node.operations.some((operation) => operation.kind === "uuid")) {
      return "123e4567-e89b-42d3-a456-426614174000"
    }
    const minimum = node.operations.find((operation) => operation.kind === "min")
    return "example".padEnd(minimum?.value ?? 0, "x")
  }
  if (node.kind === "array") {
    return Array.from({ length: Math.max(1, node.minLength ?? 0) }, () => exampleFor(node.element))
  }
  const result = Object.create(null) as Record<string, unknown>
  for (const [key, child] of Object.entries(node.fields)) {
    const example = exampleFor(child)
    if (example !== undefined || presenceOf(child) !== "optional") result[key] = example
  }
  return result
}

const fileStem = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/gu, "$1-$2").toLowerCase()

const sourceImportFor = (model: DiscoveredModel, options: CompilerOptions): string =>
  options.sourceImports?.[model.exportName] ?? options.sourceImport

const modelSource = (model: DiscoveredModel, options: CompilerOptions): string => {
  const name = model.exportName
  const stem = fileStem(name)
  return `// Generated by the Kern model compiler experiment. Do not edit.\nimport {\n  createCompiledModel,\n  type FastModelValidator,\n  type ModelOutput,\n} from ${quoted(options.runtimeImport)}\nimport { ${name} as ${name}Definition } from ${quoted(sourceImportFor(model, options))}\nimport { ${name}Fast } from "./${stem}.validator.js"\n\nexport const ${name} = createCompiledModel(\n  ${name}Definition,\n  ${name}Fast as FastModelValidator<ModelOutput<typeof ${name}Definition>>,\n)\nexport type ${name} = ModelOutput<typeof ${name}Definition>\n`
}

const validatorSource = (model: DiscoveredModel, options: CompilerOptions): string => {
  const name = model.exportName
  const needsFallback = containsRefinement(model.definition.modelNode)
  const sourceImport = needsFallback
    ? `\nimport { ${name} as ${name}Definition } from ${quoted(sourceImportFor(model, options))}\n`
    : ""
  return `// Generated by the Kern model compiler experiment. Do not edit.\nimport {\n  COMPILED_FAILURE,\n  fallbackFast,\n  isEmail,\n  isPlainRecord,\n  isUrl,\n  isUuid,\n} from ${quoted(options.runtimeImport)}\n${sourceImport}\n${emitFastValidator(model)}\n\nexport { ${name}Fast }\n`
}

const validatorDeclaration = (model: DiscoveredModel): string =>
  `export declare const ${model.exportName}Fast: (input: unknown) => unknown\n`

const registrySource = (models: readonly DiscoveredModel[]): string =>
  `// Generated by the Kern model compiler experiment. Do not edit.\n${models
    .map((model) => `export { ${model.exportName} } from "./${fileStem(model.exportName)}.js"`)
    .join("\n")}\n`

export const compileModels = (
  exports: Readonly<Record<string, unknown>>,
  options: CompilerOptions,
): CompiledArtifacts => {
  const models = discoverModels(exports)
  const definitions = Object.create(null) as Record<string, unknown>
  const forms = Object.create(null) as Record<string, unknown>
  const examples = Object.create(null) as Record<string, unknown>
  const modelSources = Object.create(null) as Record<string, string>
  const validatorSources = Object.create(null) as Record<string, string>
  const validatorDeclarations = Object.create(null) as Record<string, string>
  const report: ModelCompilationReport[] = []

  for (const candidate of models) {
    const notices: string[] = []
    definitions[candidate.exportName] = jsonSchemaFor(
      candidate.definition.modelNode,
      candidate.exportName,
      notices,
    )
    forms[candidate.exportName] = formFor(candidate.definition.modelNode, candidate.exportName)
    examples[candidate.exportName] = exampleFor(candidate.definition.modelNode)
    const stem = fileStem(candidate.exportName)
    modelSources[`${stem}.ts`] = modelSource(candidate, options)
    validatorSources[`${stem}.validator.js`] = validatorSource(candidate, options)
    validatorDeclarations[`${stem}.validator.d.ts`] = validatorDeclaration(candidate)
    report.push({
      exportName: candidate.exportName,
      mode: containsRefinement(candidate.definition.modelNode) ? "runtime-fallback" : "compiled",
      modelName: candidate.definition.modelName,
      notices: [...new Set(notices)],
    })
  }

  return {
    registrySource: registrySource(models),
    modelSources,
    validatorSources,
    validatorDeclarations,
    jsonSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $defs: definitions,
    },
    openapi: {
      openapi: "3.1.0",
      info: { title: "Generated Kern models", version: "0.0.0-experiment" },
      components: { schemas: definitions },
      paths: {},
    },
    forms,
    examples,
    report,
  }
}

export const serializeArtifact = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`
