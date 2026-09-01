/** Normalizes modern locale inputs for the narrower Intl overloads shipped by TypeScript 5.0. */
export const normalizeLocales = (
  locales: Intl.LocalesArgument | undefined,
): string | string[] | undefined => {
  if (locales === undefined) return undefined
  return Array.isArray(locales) ? locales.map(String) : String(locales)
}

const cacheLimit = 32

export interface IntlConfiguration {
  readonly key: string
  readonly locale: string | undefined
  readonly options: Record<string, boolean | number | string | undefined>
}

const isCacheValue = (value: unknown): value is boolean | number | string | undefined =>
  value === undefined ||
  typeof value === "boolean" ||
  typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value))

/** Returns a stable copy only when inspecting the caller's options cannot execute user code. */
export const intlConfiguration = (options: object): IntlConfiguration | undefined => {
  try {
    const prototype = Object.getPrototypeOf(options)
    if (prototype !== Object.prototype && prototype !== null) return undefined
    if (Object.getOwnPropertySymbols(options).length !== 0) return undefined

    const descriptors = Object.getOwnPropertyDescriptors(options)
    const normalized: Record<string, boolean | number | string | undefined> = {}
    let locale: string | undefined
    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key]
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return undefined
      const value = descriptor.value
      if (!isCacheValue(value)) return undefined
      if (key === "locale") {
        if (value !== undefined && typeof value !== "string") return undefined
        locale = value
      } else {
        normalized[key] = value
      }
    }

    return {
      key: JSON.stringify([locale, normalized]),
      locale,
      options: normalized,
    }
  } catch {
    return undefined
  }
}

export interface IntlCache<T> {
  readonly bypass: () => boolean
  readonly get: (key: string, create: () => T) => T
}

/** Creates an independent LRU that temporarily bypasses normalization under sustained churn. */
export const createIntlCache = <T>(): IntlCache<T> => {
  let entries: Map<string, T> | undefined
  let bypasses = 0
  return {
    bypass() {
      if (bypasses === 0) return false
      bypasses -= 1
      return true
    },
    get(key, create) {
      if (!entries) entries = new Map()
      const cache = entries
      const cached = cache.get(key)
      if (cached !== undefined) {
        cache.delete(key)
        cache.set(key, cached)
        return cached
      }
      const value = create()
      if (cache.size === cacheLimit) {
        cache.delete(cache.keys().next().value as string)
        bypasses = 256
      }
      cache.set(key, value)
      return value
    },
  }
}
