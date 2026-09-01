import { decimalRatio, type MoneyRoundingOptions, roundRatio } from "./rounding.js"
import { assertMinorUnits, checkedNumber } from "./shared.js"

export type { MoneyRoundingMode, MoneyRoundingOptions } from "./rounding.js"

const scale = (
  minorUnits: number,
  factor: number,
  denominatorScale: bigint,
  options?: MoneyRoundingOptions,
): number => {
  assertMinorUnits(minorUnits)
  if (denominatorScale === 1n && options === undefined && Number.isFinite(factor)) {
    const product = minorUnits * factor
    const rounded = product < 0 ? -Math.round(-product) : Math.round(product)
    if (Math.abs(product) < 1e9 && Math.abs(Math.abs(product - rounded) - 0.5) > 1e-6) {
      return rounded || 0
    }
  }
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
  options?: MoneyRoundingOptions,
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

  let numberTotal = 0
  let numberTotalIsSafe = true
  let hasPositiveRatio = false
  const weights = ratios.map((ratio) => {
    if (!Number.isSafeInteger(ratio) || ratio < 0) {
      throw new RangeError("Money allocation ratios must be non-negative safe integers")
    }
    if (ratio > 0) hasPositiveRatio = true
    if (numberTotalIsSafe) {
      const nextTotal = numberTotal + ratio
      if (Number.isSafeInteger(nextTotal)) numberTotal = nextTotal
      else numberTotalIsSafe = false
    }
    return ratio
  })
  if (!hasPositiveRatio) throw new RangeError("Money allocation requires a positive ratio")

  const negative = minorUnits < 0
  const absoluteNumber = negative ? -minorUnits : minorUnits
  if (numberTotalIsSafe && absoluteNumber % numberTotal === 0) {
    const factor = absoluteNumber / numberTotal
    return weights.map((weight) => (weight === 0 ? 0 : (negative ? -weight : weight) * factor))
  }

  const absolute = BigInt(absoluteNumber)
  const ratioTotal = numberTotalIsSafe
    ? BigInt(numberTotal)
    : weights.reduce((total, weight) => total + BigInt(weight), 0n)
  const shares = weights.map((weight, index) => {
    const bigintWeight = BigInt(weight)
    const numerator = absolute * bigintWeight
    return {
      index,
      value: numerator / ratioTotal,
      remainder: numerator % ratioTotal,
      weight: bigintWeight,
    }
  })
  let remaining = absolute - shares.reduce((total, share) => total + share.value, 0n)
  if (remaining > 0n) {
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
      remaining -= 1n
    }
  }

  return shares.map((share) => checkedNumber(negative ? -share.value : share.value))
}
