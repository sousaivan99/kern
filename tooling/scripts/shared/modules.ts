import manifestJson from "../../config/modules.json" with { type: "json" }

export interface ModuleDefinition {
  readonly benchmarkCategory: string
  readonly docsRoute: string
  readonly gzipBudgetBytes: number
  readonly id: string
}

export interface ModuleManifest {
  readonly modules: readonly ModuleDefinition[]
  readonly root: {
    readonly gzipBudgetBytes: number
    readonly id: "index"
  }
  readonly schemaVersion: 1
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0

export const validateModuleManifest = (value: unknown): ModuleManifest => {
  if (typeof value !== "object" || value === null) throw new TypeError("Invalid module manifest")
  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.modules)) {
    throw new TypeError("Unsupported module manifest schema")
  }
  const root = candidate.root as Record<string, unknown> | undefined
  if (
    root?.id !== "index" ||
    !Number.isSafeInteger(root.gzipBudgetBytes) ||
    (root.gzipBudgetBytes as number) <= 0
  ) {
    throw new TypeError("Invalid root module definition")
  }

  const ids = new Set<string>()
  const modules = candidate.modules.map((entry): ModuleDefinition => {
    if (typeof entry !== "object" || entry === null)
      throw new TypeError("Invalid module definition")
    const module = entry as Record<string, unknown>
    if (
      !nonEmptyString(module.id) ||
      !/^[a-z][a-z0-9-]*$/u.test(module.id) ||
      !nonEmptyString(module.docsRoute) ||
      !nonEmptyString(module.benchmarkCategory) ||
      !Number.isSafeInteger(module.gzipBudgetBytes) ||
      (module.gzipBudgetBytes as number) <= 0
    ) {
      throw new TypeError("Invalid module definition")
    }
    if (ids.has(module.id)) throw new TypeError(`Duplicate module id: ${module.id}`)
    ids.add(module.id)
    return module as unknown as ModuleDefinition
  })
  return {
    modules,
    root: { gzipBudgetBytes: root.gzipBudgetBytes as number, id: "index" },
    schemaVersion: 1,
  }
}

export const moduleManifest = validateModuleManifest(manifestJson)
