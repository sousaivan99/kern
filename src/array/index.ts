/** Returns the first value for each selector result, preserving input order. */
export const uniqueBy = <T, K>(values: readonly T[], key: (value: T) => K): T[] => {
  const seen = new Set<K>()
  return values.filter((value) => {
    const identity = key(value)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
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

type Falsy = false | 0 | 0n | "" | null | undefined

/** Excludes statically representable JavaScript-falsy values from `T`. */
export type Truthy<T> = T extends Falsy ? never : T

/** Removes JavaScript-falsy values, including `NaN`, while preserving input order. */
export const compact = <T>(values: readonly T[]): Array<Truthy<T>> =>
  values.filter(Boolean) as Array<Truthy<T>>
