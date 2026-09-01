const isDangerousSegment = (segment: PropertyKey): boolean =>
  segment === "__proto__" || segment === "prototype" || segment === "constructor"

/**
 * Tests an untrusted value for an own property without coercing primitives.
 * Native equivalent after checking for an object: `Object.hasOwn(value, key)`.
 */
export const hasOwn = (value: unknown, key: PropertyKey): boolean => {
  if (Object(value) !== value) return false
  return Object.hasOwn(value as object, key)
}

const plainRecordPrototype = (value: object): object | null => {
  if (Array.isArray(value)) throw new TypeError("Expected a plain object")
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Expected a plain object")
  }
  return prototype
}

const isPlainRecord = (value: object): boolean => {
  if (Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const copyProperty = (source: object, target: object, key: PropertyKey): void => {
  const descriptor = Object.getOwnPropertyDescriptor(source, key)
  if (!descriptor) return
  if (descriptor.writable && descriptor.enumerable && descriptor.configurable) {
    ;(target as Record<PropertyKey, unknown>)[key] = descriptor.value
  } else {
    Object.defineProperty(target, key, descriptor)
  }
}

const finishRecord = <T extends object>(output: T, prototype: object | null): T => {
  if (prototype !== null) Object.setPrototypeOf(output, prototype)
  return output
}

/**
 * Copies selected own property descriptors from a plain object.
 * @throws {TypeError} When `value` is not a plain or null-prototype object.
 */
export const pick = <T extends object, const K extends keyof T>(
  value: T,
  keys: readonly K[],
): Pick<T, K> => {
  const prototype = plainRecordPrototype(value)
  const output = Object.create(null) as Pick<T, K>
  for (const key of keys) copyProperty(value, output, key)
  return finishRecord(output, prototype)
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
  const prototype = plainRecordPrototype(value)
  const output = Object.create(null) as Omit<T, K>
  for (const key of Reflect.ownKeys(value)) {
    if (!omitted.has(key)) copyProperty(value, output, key)
  }
  return finishRecord(output, prototype)
}

/** A dotted path or an explicit sequence of own-property path segments. */
export type ObjectPath = string | readonly (string | number)[]

/**
 * Tests an own-property path without traversing prototypes.
 * Prototype-sensitive segments are always rejected; use an array for keys containing dots.
 */
export const hasOwnPath = (value: unknown, path: ObjectPath): boolean => {
  const segments = typeof path === "string" ? path.split(".") : path
  if (segments.length === 0 || segments.some(isDangerousSegment)) return false

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

const collectDeepFreezable = (value: unknown): object[] => {
  const seen = new WeakSet<object>()
  const objects: object[] = []
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
    objects.push(candidate)
  }
  visit(value)
  return objects
}

/**
 * Deeply freezes an array/plain-object graph without mutating it until the full graph is validated.
 * @throws {TypeError} For functions, accessors, class instances, or mutable built-in objects.
 */
export const deepFreeze = <T>(value: T & DeepFreezable<T>): DeepReadonly<T> => {
  for (const object of collectDeepFreezable(value)) Object.freeze(object)
  return value as DeepReadonly<T>
}
