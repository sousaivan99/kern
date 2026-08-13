/** Returns the first value, or `undefined` when empty. Native equivalent: `values[0]`. */
export function first<const T extends readonly [unknown, ...unknown[]]>(values: T): T[0]
export function first<T>(values: readonly T[]): T | undefined
export function first<T>(values: readonly T[]): T | undefined {
  return values[0]
}

/** Returns the last value, or `undefined` when empty. Native equivalent: `values.at(-1)`. */
export function last<const Prefix extends readonly unknown[], Value>(
  values: readonly [...Prefix, Value],
): Value
export function last<T>(values: readonly T[]): T | undefined
export function last<T>(values: readonly T[]): T | undefined {
  return values.at(-1)
}

/** Removes duplicates while preserving order. Native equivalent: `[...new Set(values)]`. */
export const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]

/** Returns the first value for each selector result, preserving input order. */
export const uniqueBy = <T, K>(
  values: readonly T[],
  selector: (value: T, index: number) => K,
): T[] => {
  const seen = new Set<K>()
  return values.filter((value, index) => {
    const identity = selector(value, index)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

/**
 * Groups values by a property key into a null-prototype object.
 * Native equivalent: `Object.groupBy(values, selector)`.
 */
export const groupBy = <T, K extends PropertyKey>(
  values: readonly T[],
  selector: (value: T, index: number) => K,
): Partial<Record<K, T[]>> => {
  const output = Object.create(null) as Partial<Record<K, T[]>>
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] as T
    const key = selector(value, index)
    const group = output[key]
    if (group) group.push(value)
    else output[key] = [value]
  }
  return output
}

/** Splits values into predicate matches and non-matches while preserving input order. */
export function partition<T, Selected extends T>(
  values: readonly T[],
  predicate: (value: T, index: number) => value is Selected,
): [matching: Selected[], remaining: Array<Exclude<T, Selected>>]
export function partition<T>(
  values: readonly T[],
  predicate: (value: T, index: number) => boolean,
): [matching: T[], remaining: T[]]
export function partition<T>(
  values: readonly T[],
  predicate: (value: T, index: number) => boolean,
): [matching: T[], remaining: T[]] {
  const matching: T[] = []
  const remaining: T[] = []
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] as T
    if (predicate(value, index)) matching.push(value)
    else remaining.push(value)
  }
  return [matching, remaining]
}

/**
 * Splits an array into copies containing at most `size` values.
 * @throws {RangeError} When `size` is not a positive safe integer.
 */
export const chunk = <T>(values: readonly T[], size: number): T[][] => {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new RangeError("Chunk size must be a positive safe integer")
  }
  const output: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size))
  }
  return output
}

type FalsyValue = false | 0 | 0n | "" | null | undefined

/** Excludes statically representable JavaScript-falsy values from `T`. */
export type NonFalsy<T> = T extends FalsyValue ? never : T

/**
 * Removes JavaScript-falsy values, including `NaN`, while preserving input order.
 * Native equivalent: `values.filter(Boolean)`.
 */
export const withoutFalsy = <T>(values: readonly T[]): Array<NonFalsy<T>> =>
  values.filter(Boolean) as Array<NonFalsy<T>>
