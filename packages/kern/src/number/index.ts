import { createIntlCache, intlConfiguration, normalizeLocales } from "../intl.js"

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
  if (precision === 2 && value > -1e9 && value < 1e9) {
    const scaled = value * 100
    const rounded = Math.round(scaled)
    if (Math.abs(scaled - rounded) < 0.4999) {
      const output = rounded / 100
      return output === 0 ? 0 : output
    }
  }

  if (!Number.isInteger(precision) || precision < -100 || precision > 100) {
    throw new RangeError("Precision must be an integer between -100 and 100")
  }
  if (!Number.isFinite(value)) return value
  if (precision === 0) {
    const rounded = Math.round(value)
    return rounded === 0 ? 0 : rounded
  }

  if (precision >= -15 && precision <= 15) {
    const magnitude = precision === 2 ? 100 : 10 ** Math.abs(precision)
    const scaled = precision > 0 ? value * magnitude : value / magnitude
    if (Number.isFinite(scaled) && scaled !== 0 && Math.abs(scaled) <= 1e15) {
      const absolute = Math.abs(scaled)
      const rounded = Math.round(scaled)
      const halfDistance = Math.abs(Math.abs(scaled - rounded) - 0.5)
      const uncertainty = Number.EPSILON * Math.max(1, absolute) * 4
      if (halfDistance > uncertainty) {
        const output = precision > 0 ? rounded / magnitude : rounded * magnitude
        return output === 0 ? 0 : output
      }
    }
  }
  return shiftDecimal(Math.round(shiftDecimal(value, precision)), -precision)
}

/** Controls how range boundaries are evaluated. */
export interface BetweenOptions {
  /** Includes both boundaries by default. */
  readonly inclusive?: boolean
}

/**
 * Tests whether a number falls between two ordered bounds.
 * @throws {RangeError} For `NaN` or reversed bounds.
 */
export const isBetween = (
  value: number,
  minimum: number,
  maximum: number,
  options: BetweenOptions = {},
): boolean => {
  assertBounds(minimum, maximum)
  const inclusive = options.inclusive ?? true
  return inclusive ? value >= minimum && value <= maximum : value > minimum && value < maximum
}

/**
 * Returns the percentage that `part` represents of `total`: `percentageOfTotal(1, 4)` is `25`.
 * @throws {RangeError} For non-finite operands or a zero total.
 */
export const percentageOfTotal = (part: number, total: number): number => {
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

const numberFormats = createIntlCache<Intl.NumberFormat>()

const numberFormatter = (
  options: NumberFormatOptions,
  overrides?: Intl.NumberFormatOptions,
): Intl.NumberFormat => {
  if (numberFormats.bypass()) {
    const { locale, ...formatOptions } = options
    return new Intl.NumberFormat(
      normalizeLocales(locale),
      overrides ? { ...formatOptions, ...overrides } : formatOptions,
    )
  }
  const configuration = intlConfiguration(options)
  if (!configuration) {
    const { locale, ...formatOptions } = options
    return new Intl.NumberFormat(
      normalizeLocales(locale),
      overrides ? { ...formatOptions, ...overrides } : formatOptions,
    )
  }
  const resolved = overrides ? { ...configuration.options, ...overrides } : configuration.options
  const key = overrides ? JSON.stringify([configuration.key, overrides]) : configuration.key
  return numberFormats.get(key, () => new Intl.NumberFormat(configuration.locale, resolved))
}

/** Formats a number. Native equivalent: `new Intl.NumberFormat(locale, options).format(value)`. */
export const formatNumber = (value: number, options: NumberFormatOptions = {}): string => {
  return numberFormatter(options).format(value)
}

/** Formats a number with native compact notation. */
export const formatCompact = (value: number, options: NumberFormatOptions = {}): string => {
  return numberFormatter(options, { notation: "compact" }).format(value)
}

/**
 * Formats percentage points: `25` becomes `25%`.
 * Native equivalent: `new Intl.NumberFormat(locale, { style: "percent" }).format(value / 100)`.
 */
export const formatPercentage = (percentage: number, options: NumberFormatOptions = {}): string => {
  return numberFormatter(options, { style: "percent" }).format(percentage / 100)
}
