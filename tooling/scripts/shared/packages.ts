import manifestJson from "../../config/packages.json" with { type: "json" }

export type PackageRuntime = "browser" | "react" | "universal" | "vue"

export interface PackageDefinition {
  readonly directory: string
  readonly docsRoute: string
  readonly externals?: readonly string[]
  readonly frameworkPeers: Readonly<Record<string, string>>
  readonly gzipBudgetBytes: number
  readonly id: string
  readonly name: `@lithekit/${string}`
  readonly publishOrder: number
  readonly releaseGroup: string
  readonly runtime: PackageRuntime
  readonly runtimeTargets: readonly string[]
}

export interface PackageManifest {
  readonly packages: readonly PackageDefinition[]
  readonly schemaVersion: 1
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0

export const validatePackageManifest = (value: unknown): PackageManifest => {
  if (typeof value !== "object" || value === null) throw new TypeError("Invalid package manifest")
  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.packages)) {
    throw new TypeError("Unsupported package manifest schema")
  }

  const ids = new Set<string>()
  const names = new Set<string>()
  const packages = candidate.packages.map((entry): PackageDefinition => {
    if (typeof entry !== "object" || entry === null)
      throw new TypeError("Invalid package definition")
    const packageDefinition = entry as Record<string, unknown>
    if (
      !nonEmptyString(packageDefinition.id) ||
      !/^[a-z][a-z0-9-]*$/u.test(packageDefinition.id) ||
      !nonEmptyString(packageDefinition.name) ||
      packageDefinition.name !== `@lithekit/${packageDefinition.id}` ||
      packageDefinition.directory !== `packages/${packageDefinition.id}` ||
      !nonEmptyString(packageDefinition.docsRoute) ||
      !Number.isSafeInteger(packageDefinition.gzipBudgetBytes) ||
      (packageDefinition.gzipBudgetBytes as number) <= 0 ||
      !Number.isSafeInteger(packageDefinition.publishOrder) ||
      !nonEmptyString(packageDefinition.releaseGroup) ||
      !Array.isArray(packageDefinition.runtimeTargets) ||
      packageDefinition.runtimeTargets.length === 0 ||
      !packageDefinition.runtimeTargets.every(nonEmptyString) ||
      typeof packageDefinition.frameworkPeers !== "object" ||
      packageDefinition.frameworkPeers === null ||
      !["browser", "react", "universal", "vue"].includes(String(packageDefinition.runtime))
    ) {
      throw new TypeError("Invalid package definition")
    }
    if (ids.has(packageDefinition.id) || names.has(packageDefinition.name)) {
      throw new TypeError(`Duplicate package definition: ${packageDefinition.name}`)
    }
    ids.add(packageDefinition.id)
    names.add(packageDefinition.name)
    return packageDefinition as unknown as PackageDefinition
  })

  return { packages, schemaVersion: 1 }
}

export const packageManifest = validatePackageManifest(manifestJson)

export const packageById = (id: string): PackageDefinition => {
  const definition = packageManifest.packages.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Unknown Lithekit package: ${id}`)
  return definition
}
