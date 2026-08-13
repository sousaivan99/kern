export type MoneyRoundingMode =
  | "ceil"
  | "expand"
  | "floor"
  | "halfCeil"
  | "halfEven"
  | "halfExpand"
  | "halfFloor"
  | "halfTrunc"
  | "trunc"

export interface MoneyRoundingOptions {
  readonly roundingMode?: MoneyRoundingMode
  readonly roundingIncrement?: number
}

const roundingModes = new Set<MoneyRoundingMode>([
  "ceil",
  "expand",
  "floor",
  "halfCeil",
  "halfEven",
  "halfExpand",
  "halfFloor",
  "halfTrunc",
  "trunc",
])

interface NormalizedRoundingOptions {
  readonly roundingMode: MoneyRoundingMode
  readonly roundingIncrement: bigint
}

const normalizeRounding = (options: MoneyRoundingOptions): NormalizedRoundingOptions => {
  const roundingMode = options.roundingMode ?? "halfExpand"
  if (!roundingModes.has(roundingMode)) throw new RangeError("Unknown money rounding mode")

  const increment = options.roundingIncrement ?? 1
  if (!Number.isSafeInteger(increment) || increment <= 0) {
    throw new RangeError("roundingIncrement must be a positive safe integer")
  }
  return { roundingMode, roundingIncrement: BigInt(increment) }
}

export const roundRatio = (
  numerator: bigint,
  denominator: bigint,
  options: MoneyRoundingOptions = {},
): bigint => {
  if (denominator <= 0n) throw new RangeError("Rounding denominator must be positive")
  const { roundingMode, roundingIncrement } = normalizeRounding(options)
  const scaledDenominator = denominator * roundingIncrement
  const negative = numerator < 0n
  const absolute = negative ? -numerator : numerator
  const lower = absolute / scaledDenominator
  const remainder = absolute % scaledDenominator

  let roundUp = false
  if (remainder !== 0n) {
    if (roundingMode === "expand") roundUp = true
    else if (roundingMode === "ceil") roundUp = !negative
    else if (roundingMode === "floor") roundUp = negative
    else if (roundingMode.startsWith("half")) {
      const comparison = remainder * 2n - scaledDenominator
      if (comparison > 0n) roundUp = true
      else if (comparison === 0n) {
        if (roundingMode === "halfExpand") roundUp = true
        else if (roundingMode === "halfCeil") roundUp = !negative
        else if (roundingMode === "halfFloor") roundUp = negative
        else if (roundingMode === "halfEven") roundUp = lower % 2n !== 0n
      }
    }
  }

  const rounded = (lower + (roundUp ? 1n : 0n)) * roundingIncrement
  return negative ? -rounded : rounded
}

export const decimalRatio = (value: number): readonly [numerator: bigint, denominator: bigint] => {
  if (!Number.isFinite(value)) throw new RangeError("Money factors must be finite")

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
