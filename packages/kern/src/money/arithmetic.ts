import { decimalRatio, type MoneyRoundingOptions, roundRatio } from "./rounding.js"

export type { MoneyRoundingMode, MoneyRoundingOptions } from "./rounding.js"

const assertMinorUnits = (value: number): void => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Money values must be safe integers in minor units")
  }
}

const checkedNumber = (value: bigint): number => {
  const output = Number(value)
  if (!Number.isSafeInteger(output)) {
    throw new RangeError("Money result exceeds the safe integer range")
  }
  return output
}

const scale = (
  minorUnits: number,
  factor: number,
  denominatorScale: bigint,
  options: MoneyRoundingOptions,
): number => {
  assertMinorUnits(minorUnits)
  const [numerator, denominator] = decimalRatio(factor)
  return checkedNumber(
    roundRatio(BigInt(minorUnits) * numerator, denominator * denominatorScale, options),
  )
}

/** Adds two safe-integer minor-unit amounts. */
export const addMoney = (leftMinorUnits: number, rightMinorUnits: number): number => {
  assertMinorUnits(leftMinorUnits)
  assertMinorUnits(rightMinorUnits)
  const result = leftMinorUnits + rightMinorUnits
  assertMinorUnits(result)
  return result
}

/** Adds safe-integer minor-unit amounts, returning zero for an empty input. */
export const sumMoney = (values: readonly number[]): number => {
  let total = 0
  for (const value of values) total = addMoney(total, value)
  return total
}

/** Subtracts two safe-integer minor-unit amounts. */
export const subtractMoney = (leftMinorUnits: number, rightMinorUnits: number): number => {
  assertMinorUnits(leftMinorUnits)
  assertMinorUnits(rightMinorUnits)
  const result = leftMinorUnits - rightMinorUnits
  assertMinorUnits(result)
  return result
}

/** Rounds a minor-unit amount to an exact minor-unit increment. */
export const roundMoney = (minorUnits: number, options: MoneyRoundingOptions = {}): number => {
  assertMinorUnits(minorUnits)
  return checkedNumber(roundRatio(BigInt(minorUnits), 1n, options))
}

/** Multiplies minor units with exact decimal conversion and configurable rounding. */
export const multiplyMoney = (
  minorUnits: number,
  multiplier: number,
  options: MoneyRoundingOptions = {},
): number => scale(minorUnits, multiplier, 1n, options)

/** Returns a percentage of minor units. `percentage` uses percentage points: 15 means 15%. */
export const percentageOf = (
  minorUnits: number,
  percentage: number,
  options: MoneyRoundingOptions = {},
): number => scale(minorUnits, percentage, 100n, options)

/** Applies a discount from 0 through 100 percentage points. */
export const applyDiscount = (
  minorUnits: number,
  percentage: number,
  options: MoneyRoundingOptions = {},
): number => {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new RangeError("Discount percentage must be between 0 and 100")
  }
  return subtractMoney(minorUnits, percentageOf(minorUnits, percentage, options))
}

/**
 * Allocates an amount exactly by non-negative integer weights.
 * Fractional remainders are resolved largest-first with stable input-order ties.
 */
export const allocateMoney = (minorUnits: number, ratios: readonly number[]): number[] => {
  assertMinorUnits(minorUnits)
  if (ratios.length === 0) throw new RangeError("Money allocation ratios cannot be empty")

  let ratioTotal = 0n
  const weights = ratios.map((ratio) => {
    if (!Number.isSafeInteger(ratio) || ratio < 0) {
      throw new RangeError("Money allocation ratios must be non-negative safe integers")
    }
    const weight = BigInt(ratio)
    ratioTotal += weight
    return weight
  })
  if (ratioTotal === 0n) throw new RangeError("Money allocation requires a positive ratio")

  const negative = minorUnits < 0
  const absolute = BigInt(negative ? -minorUnits : minorUnits)
  const shares = weights.map((weight, index) => {
    const numerator = absolute * weight
    return { index, value: numerator / ratioTotal, remainder: numerator % ratioTotal, weight }
  })
  let distributed = shares.reduce((total, share) => total + share.value, 0n)
  let remaining = absolute - distributed
  const ranked = shares
    .filter((share) => share.weight > 0n)
    .sort((left, right) =>
      left.remainder === right.remainder
        ? left.index - right.index
        : left.remainder > right.remainder
          ? -1
          : 1,
    )

  for (let index = 0; remaining > 0n; index += 1) {
    const share = ranked[index]
    if (!share) throw new RangeError("Unable to allocate money exactly")
    share.value += 1n
    distributed += 1n
    remaining -= 1n
  }

  return shares.map((share) => checkedNumber(negative ? -share.value : share.value))
}
