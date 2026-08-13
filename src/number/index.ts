import { normalizeLocales } from "../intl.js"

const assertBounds = (minimum: number, maximum: number): void => {
  if (Number.isNaN(minimum) || Number.isNaN(maximum)) {
    throw new RangeError("Bounds cannot be NaN")
  }
  if (minimum > maximum) throw new RangeError("Minimum cannot be greater than maximum")
}

/** Clamps `value` to the inclusive bounds. A `NaN` value remains `NaN`. */
export const clamp = (value: number, minimum: number, maximum: number): number => {
  assertBounds(minimum, maximum)
  return Math.min(maximum, Math.max(minimum, value))
}

const shiftDecimal = (value: number, places: number): number => {
  const [coefficient, exponent = "0"] = value.toString().split("e")
  return Number(`${coefficient}e${Number(exponent) + places}`)
}

/**
 * Rounds a number to a decimal precision without the common exponent-shift error.
 * `NaN` and infinities are returned unchanged.
 */
export const round = (value: number, precision = 0): number => {
  if (!Number.isInteger(precision) || precision < -100 || precision > 100) {
    throw new RangeError("Precision must be an integer between -100 and 100")
  }
  if (!Number.isFinite(value)) return value
  return shiftDecimal(Math.round(shiftDecimal(value, precision)), -precision)
}

/**
 * Tests whether a number falls between two ordered bounds.
 * @throws {RangeError} For `NaN` or reversed bounds.
 */
export const isBetween = (
  value: number,
  minimum: number,
  maximum: number,
  inclusive = true,
): boolean => {
  assertBounds(minimum, maximum)
  return inclusive ? value >= minimum && value <= maximum : value > minimum && value < maximum
}

/**
 * Returns percentage points: `calculatePercentage(1, 4)` is `25`.
 * @throws {RangeError} For non-finite operands or a zero total.
 */
export const calculatePercentage = (part: number, total: number): number => {
  if (!Number.isFinite(part) || !Number.isFinite(total)) {
    throw new RangeError("Percentage operands must be finite numbers")
  }
  if (total === 0) throw new RangeError("Total cannot be zero")
  return (part / total) * 100
}

/** Number formatting options with `locale` colocated for convenience. */
export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  readonly locale?: Intl.LocalesArgument
}

/** Formats a number with native compact notation. */
export const formatCompact = (value: number, options: NumberFormatOptions = {}): string => {
  const { locale, ...formatOptions } = options
  return new Intl.NumberFormat(normalizeLocales(locale), {
    ...formatOptions,
    notation: "compact",
  }).format(value)
}

/** Formats a ratio using `Intl` percent semantics: `0.25` becomes `25%`. */
export const formatPercent = (ratio: number, options: NumberFormatOptions = {}): string => {
  const { locale, ...formatOptions } = options
  return new Intl.NumberFormat(normalizeLocales(locale), {
    ...formatOptions,
    style: "percent",
  }).format(ratio)
}
