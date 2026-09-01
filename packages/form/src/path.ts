import type { StandardSchemaV1 } from "./types.js"

export type Path = readonly (string | number)[]

const safeSegment = /^[A-Za-z_$][A-Za-z0-9_$]*$/u
const numeric = /^(?:0|[1-9][0-9]*)$/u

export class FormPathError extends Error {}

export const parsePath = (name: string): Path => {
  if (name.length === 0 || name.length > 512) throw new FormPathError("Invalid field name length")
  if (name.startsWith("[") && name.endsWith("]")) {
    const inner = name.slice(1, -1)
    if (inner.length > 0 && !numeric.test(inner) && !inner.startsWith('"')) return [inner]
  }

  const output: Array<string | number> = []
  let index = 0
  let expectSegment = true
  while (index < name.length) {
    if (output.length >= 32) throw new FormPathError("Field path exceeds 32 segments")
    const character = name[index]
    if (character === ".") throw new FormPathError("Field paths cannot contain empty segments")
    if (character === "[") {
      let close: number
      if (name[index + 1] === '"') {
        let cursor = index + 2
        let escaped = false
        while (cursor < name.length) {
          const next = name[cursor] as string
          if (escaped) escaped = false
          else if (next === "\\") escaped = true
          else if (next === '"') break
          cursor += 1
        }
        close = name[cursor] === '"' && name[cursor + 1] === "]" ? cursor + 1 : -1
      } else close = name.indexOf("]", index + 1)
      if (close < 0) throw new FormPathError("Field path has an unclosed bracket")
      const inner = name.slice(index + 1, close)
      if (inner.startsWith('"')) {
        let decoded: unknown
        try {
          decoded = JSON.parse(inner)
        } catch {
          throw new FormPathError("Field path contains an invalid quoted segment")
        }
        if (typeof decoded !== "string" || decoded.length === 0) {
          throw new FormPathError("Quoted field segments must be nonempty strings")
        }
        output.push(decoded)
      } else if (numeric.test(inner)) {
        const value = Number(inner)
        if (value > 10_000) throw new FormPathError("Field array index exceeds 10000")
        output.push(value)
      } else {
        throw new FormPathError("Bracket segments must be numeric or JSON strings")
      }
      index = close + 1
      expectSegment = false
    } else {
      const start = index
      while (index < name.length && name[index] !== "." && name[index] !== "[") index += 1
      const segment = name.slice(start, index)
      if (segment.length === 0) throw new FormPathError("Field path contains an empty segment")
      output.push(segment)
      expectSegment = false
    }
    if (index < name.length && name[index] === ".") {
      index += 1
      expectSegment = true
    }
  }
  if (expectSegment || output.length === 0) throw new FormPathError("Invalid field path")
  return output
}

export const canonicalPath = (path: Path): string =>
  path
    .map((segment, index) => {
      if (typeof segment === "number") return `[${segment}]`
      if (safeSegment.test(segment)) return index === 0 ? segment : `.${segment}`
      return `[${JSON.stringify(segment)}]`
    })
    .join("")

export const issuePath = (
  path: StandardSchemaV1.Issue["path"],
): readonly (string | number)[] | undefined => {
  if (!path) return undefined
  const output: Array<string | number> = []
  for (const segment of path) {
    const key =
      typeof segment === "object" && segment !== null && "key" in segment ? segment.key : segment
    if (typeof key !== "string" && typeof key !== "number") return undefined
    if (typeof key === "number" && (!Number.isSafeInteger(key) || key < 0 || key > 10_000)) {
      return undefined
    }
    output.push(key)
  }
  return output
}

const own = (value: object, key: PropertyKey): boolean => Object.hasOwn(value, key)

export const getPath = (value: unknown, path: Path): unknown => {
  let current = value
  for (const segment of path) {
    if (typeof current !== "object" || current === null || !own(current, segment)) return undefined
    current = Reflect.get(current, segment)
  }
  return current
}

export const hasPath = (value: unknown, path: Path): boolean => {
  let current = value
  for (const segment of path) {
    if (typeof current !== "object" || current === null || !own(current, segment)) return false
    current = Reflect.get(current, segment)
  }
  return true
}

const container = (next: string | number): Record<string, unknown> | unknown[] =>
  typeof next === "number" ? [] : Object.create(null)

export const setPath = (root: unknown, path: Path, value: unknown): void => {
  if (typeof root !== "object" || root === null) throw new FormPathError("Invalid form root")
  let current = root as Record<PropertyKey, unknown> | unknown[]
  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index] as string | number
    const last = index === path.length - 1
    if (Array.isArray(current) !== (typeof segment === "number")) {
      throw new FormPathError("Field names construct conflicting object and array shapes")
    }
    if (last) {
      if (own(current, segment)) throw new FormPathError("Duplicate field path")
      Object.defineProperty(current, segment, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      })
      continue
    }
    const nextSegment = path[index + 1] as string | number
    if (!own(current, segment)) {
      Object.defineProperty(current, segment, {
        configurable: true,
        enumerable: true,
        value: container(nextSegment),
        writable: true,
      })
    }
    const next = Reflect.get(current, segment)
    if (
      typeof next !== "object" ||
      next === null ||
      Array.isArray(next) !== (typeof nextSegment === "number")
    ) {
      throw new FormPathError("Field names construct conflicting object and array shapes")
    }
    current = next as Record<PropertyKey, unknown> | unknown[]
  }
}

export const createRoot = (paths: readonly Path[]): Record<string, unknown> | unknown[] =>
  typeof paths[0]?.[0] === "number" ? [] : Object.create(null)

export const immutable = <T>(value: T): T => {
  const isFile = typeof File !== "undefined" && value instanceof File
  const isBlob = typeof Blob !== "undefined" && value instanceof Blob
  if (typeof value !== "object" || value === null || isFile || isBlob) {
    return value
  }
  for (const key of Reflect.ownKeys(value)) immutable(Reflect.get(value, key))
  return Object.freeze(value)
}

const cloneContainer = (value: object): Record<PropertyKey, unknown> | unknown[] => {
  if (Array.isArray(value)) return value.slice()
  const clone: Record<PropertyKey, unknown> = Object.create(null)
  for (const key of Reflect.ownKeys(value)) {
    Object.defineProperty(clone, key, {
      configurable: true,
      enumerable: true,
      value: Reflect.get(value, key),
      writable: true,
    })
  }
  return clone
}

export const replacePath = <T>(root: T, path: Path, value: unknown): T => {
  if (typeof root !== "object" || root === null || path.length === 0) {
    throw new FormPathError("Invalid form path replacement")
  }
  const replacement = immutable(value)
  const replace = (current: object, index: number): object => {
    const segment = path[index] as string | number
    if (Array.isArray(current) !== (typeof segment === "number") || !own(current, segment)) {
      throw new FormPathError("Cannot replace a missing or conflicting field path")
    }
    const clone = cloneContainer(current)
    const last = index === path.length - 1
    const next = last ? replacement : Reflect.get(current, segment)
    if (!last && (typeof next !== "object" || next === null)) {
      throw new FormPathError("Cannot replace a missing or conflicting field path")
    }
    Object.defineProperty(clone, segment, {
      configurable: false,
      enumerable: true,
      value: last ? replacement : replace(next as object, index + 1),
      writable: false,
    })
    return Object.freeze(clone)
  }
  return replace(root, 0) as T
}

export const structurallyEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false
  }
  if (typeof File !== "undefined" && (left instanceof File || right instanceof File)) return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const leftKeys = Reflect.ownKeys(left)
  const rightKeys = Reflect.ownKeys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (const key of leftKeys) {
    if (
      !Object.hasOwn(right, key) ||
      !structurallyEqual(Reflect.get(left, key), Reflect.get(right, key))
    ) {
      return false
    }
  }
  return true
}
