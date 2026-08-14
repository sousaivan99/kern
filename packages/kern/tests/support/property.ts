const DEFAULT_SEED = 0x4b45524e
const DEFAULT_CASES = 256

const environmentInteger = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`)
  }
  return parsed
}

const rootSeed = environmentInteger("KERN_FUZZ_SEED", DEFAULT_SEED) >>> 0
export const propertyCases = environmentInteger("KERN_FUZZ_CASES", DEFAULT_CASES)

const hashName = (name: string): number => {
  let hash = 2_166_136_261
  for (const character of name) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

export class Random {
  #state: number

  constructor(seed: number) {
    this.#state = seed || 0x6d2b79f5
  }

  uint32(): number {
    let value = this.#state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.#state = value >>> 0
    return this.#state
  }

  integer(minimum: number, maximum: number): number {
    if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum < minimum) {
      throw new RangeError("Invalid random integer range")
    }
    return minimum + (this.uint32() % (maximum - minimum + 1))
  }

  pick<T>(values: readonly T[]): T {
    const value = values[this.integer(0, values.length - 1)]
    if (value === undefined) throw new RangeError("Cannot pick from an empty array")
    return value
  }

  boolean(): boolean {
    return (this.uint32() & 1) === 1
  }
}

const printable = (value: unknown): string => {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === "bigint") return `${item}n`
      if (typeof item === "symbol") return String(item)
      if (typeof item === "object" && item !== null) {
        if (seen.has(item)) return "[Circular]"
        seen.add(item)
      }
      return item
    })
  } catch {
    return "[Unserializable hostile input]"
  }
}

export const checkProperty = <T>(
  name: string,
  generate: (random: Random, index: number) => T,
  verify: (value: T, index: number) => void,
): void => {
  const seed = (rootSeed ^ hashName(name)) >>> 0
  const random = new Random(seed)
  for (let index = 0; index < propertyCases; index += 1) {
    const value = generate(random, index)
    try {
      verify(value, index)
    } catch (error) {
      throw new Error(`${name} failed (seed=${seed}, case=${index}, input=${printable(value)})`, {
        cause: error,
      })
    }
  }
}

export const randomSafeInteger = (random: Random): number => {
  const magnitude =
    ((BigInt(random.uint32()) << 32n) | BigInt(random.uint32())) %
    (BigInt(Number.MAX_SAFE_INTEGER) + 1n)
  return Number(random.boolean() ? magnitude : -magnitude)
}
