const assertMinorUnits = (value: number): void => {
  if (!Number.isSafeInteger(value))
    throw new RangeError("Money values must be safe integers in minor units")
}

const checkedNumber = (value: bigint): number => {
  const output = Number(value)
  if (!Number.isSafeInteger(output))
    throw new RangeError("Money result exceeds the safe integer range")
  return output
}

const decimalRatio = (value: number): readonly [numerator: bigint, denominator: bigint] => {
  if (!Number.isFinite(value)) throw new RangeError("Multiplier must be finite")

  const [coefficient = "0", exponentText = "0"] = value.toString().toLowerCase().split("e")
  const negative = coefficient.startsWith("-")
  const unsigned = coefficient.replace(/^[+-]/u, "")
  const [whole = "0", fraction = ""] = unsigned.split(".")
  const exponent = Number(exponentText)
  let numerator = BigInt(`${whole}${fraction}` || "0")
  let scale = fraction.length - exponent
  if (scale < 0) {
    numerator *= 10n ** BigInt(-scale)
    scale = 0
  }
  if (negative) numerator = -numerator
  return [numerator, 10n ** BigInt(scale)]
}

const divideRounded = (numerator: bigint, denominator: bigint): bigint => {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  if ((remainder < 0n ? -remainder : remainder) * 2n < denominator) return quotient
  return quotient + (numerator < 0n ? -1n : 1n)
}

const scale = (minorUnits: number, factor: number, denominatorScale = 1n): number => {
  assertMinorUnits(minorUnits)
  const [numerator, denominator] = decimalRatio(factor)
  return checkedNumber(
    divideRounded(BigInt(minorUnits) * numerator, denominator * denominatorScale),
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

/** Subtracts two safe-integer minor-unit amounts. */
export const subtractMoney = (leftMinorUnits: number, rightMinorUnits: number): number => {
  assertMinorUnits(leftMinorUnits)
  assertMinorUnits(rightMinorUnits)
  const result = leftMinorUnits - rightMinorUnits
  assertMinorUnits(result)
  return result
}

/** Multiplies minor units and rounds half away from zero to the nearest minor unit. */
export const multiplyMoney = (minorUnits: number, multiplier: number): number =>
  scale(minorUnits, multiplier)

/** Returns a percentage of minor units. `percentage` uses percentage points: 15 means 15%. */
export const percentageOf = (minorUnits: number, percentage: number): number =>
  scale(minorUnits, percentage, 100n)

/** Applies a percentage-point discount and returns minor units. */
export const applyDiscount = (minorUnits: number, percentage: number): number =>
  subtractMoney(minorUnits, percentageOf(minorUnits, percentage))
