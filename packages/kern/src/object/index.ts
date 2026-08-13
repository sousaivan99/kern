const dangerousSegments = new Set<PropertyKey>(["__proto__", "prototype", "constructor"])

/**
 * Tests an untrusted value for an own property without coercing primitives.
 * Native equivalent after checking for an object: `Object.hasOwn(value, key)`.
 */
export const hasOwn = (value: unknown, key: PropertyKey): boolean => {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return false
  return Object.hasOwn(value, key)
}

const isPlainRecord = (value: object): boolean => {
  if (Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const assertPlainRecord = (value: object): void => {
  if (!isPlainRecord(value)) throw new TypeError("Expected a plain object")
}

const createRecordLike = (source: object): object =>
  Object.getPrototypeOf(source) === null ? Object.create(null) : {}

const copyProperty = (source: object, target: object, key: PropertyKey): void => {
  const descriptor = Object.getOwnPropertyDescriptor(source, key)
  if (descriptor) Object.defineProperty(target, key, descriptor)
}

/**
 * Copies selected own property descriptors from a plain object.
 * @throws {TypeError} When `value` is not a plain or null-prototype object.
 */
export const pick = <T extends object, const K extends keyof T>(
  value: T,
  keys: readonly K[],
): Pick<T, K> => {
  assertPlainRecord(value)
  const output = createRecordLike(value) as Pick<T, K>
  for (const key of keys) {
    if (Object.hasOwn(value, key)) copyProperty(value, output, key)
  }
  return output
}

/**
 * Copies all but the selected own property descriptors from a plain object.
 * @throws {TypeError} When `value` is not a plain or null-prototype object.
 */
export const omit = <T extends object, const K extends keyof T>(
  value: T,
  keys: readonly K[],
): Omit<T, K> => {
  const omitted = new Set<PropertyKey>(keys)
  assertPlainRecord(value)
  const output = createRecordLike(value) as Omit<T, K>
  for (const key of Reflect.ownKeys(value)) {
    if (!omitted.has(key)) copyProperty(value, output, key)
  }
  return output
}

/** A dotted path or an explicit sequence of own-property path segments. */
export type ObjectPath = string | readonly (string | number)[]

/**
 * Tests an own-property path without traversing prototypes.
 * Prototype-sensitive segments are always rejected; use an array for keys containing dots.
 */
export const hasOwnPath = (value: unknown, path: ObjectPath): boolean => {
  const segments = typeof path === "string" ? path.split(".") : path
  if (segments.length === 0 || segments.some((segment) => dangerousSegments.has(segment)))
    return false

  let current = value
  for (const segment of segments) {
    if ((typeof current !== "object" && typeof current !== "function") || current === null) {
      return false
    }
    if (!Object.hasOwn(current, segment)) return false
    current = (current as Record<PropertyKey, unknown>)[segment]
  }
  return true
}

type Primitive = string | number | bigint | boolean | symbol | null | undefined
type MutableBuiltin =
  | Date
  | RegExp
  | Map<unknown, unknown>
  | ReadonlyMap<unknown, unknown>
  | Set<unknown>
  | ReadonlySet<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>
  | Promise<unknown>
  | ArrayBuffer
  | ArrayBufferView
  | Error
  | URL

/** Deeply readonly form of data supported by `deepFreeze`; unsupported built-ins become `never`. */
export type DeepReadonly<T> = [unknown] extends [T]
  ? unknown
  : T extends Primitive
    ? T
    : T extends (...arguments_: never[]) => unknown
      ? never
      : T extends MutableBuiltin
        ? never
        : T extends readonly unknown[]
          ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
          : T extends object
            ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
            : never

type DeepFreezable<T> = [unknown] extends [T]
  ? unknown
  : T extends Primitive
    ? T
    : T extends (...arguments_: never[]) => unknown
      ? never
      : T extends MutableBuiltin
        ? never
        : T extends readonly unknown[]
          ? { readonly [K in keyof T]: DeepFreezable<T[K]> }
          : T extends object
            ? { readonly [K in keyof T]: DeepFreezable<T[K]> }
            : never

const assertDeepFreezable = (value: unknown): void => {
  const seen = new WeakSet<object>()
  const visit = (candidate: unknown): void => {
    if (typeof candidate === "function") throw new TypeError("Functions cannot be deeply frozen")
    if (candidate === null || typeof candidate !== "object") return
    if (seen.has(candidate)) return
    if (!Array.isArray(candidate) && !isPlainRecord(candidate)) {
      throw new TypeError("Only arrays and plain objects can be deeply frozen")
    }
    seen.add(candidate)
    for (const key of Reflect.ownKeys(candidate)) {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key)
      if (!descriptor || !("value" in descriptor)) {
        throw new TypeError("Accessor properties cannot be deeply frozen")
      }
      visit(descriptor.value)
    }
  }
  visit(value)
}

/**
 * Deeply freezes an array/plain-object graph without mutating it until the full graph is validated.
 * @throws {TypeError} For functions, accessors, class instances, or mutable built-in objects.
 */
export const deepFreeze = <T>(value: T & DeepFreezable<T>): DeepReadonly<T> => {
  assertDeepFreezable(value)
  const seen = new WeakSet<object>()
  const freeze = (candidate: unknown): void => {
    if (typeof candidate !== "object" || candidate === null || seen.has(candidate)) return
    seen.add(candidate)
    for (const key of Reflect.ownKeys(candidate)) {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key)
      if (descriptor && "value" in descriptor) freeze(descriptor.value)
    }
    Object.freeze(candidate)
  }
  freeze(value)
  return value as DeepReadonly<T>
}
