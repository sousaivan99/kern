import { normalizeLocales } from "../intl.js"

/** Native number-format options with `locale` colocated; currency and style are fixed by Kern. */
export interface MoneyFormatOptions extends Omit<Intl.NumberFormatOptions, "currency" | "style"> {
  readonly locale?: Intl.LocalesArgument
}

/** Returns the native `Intl` fraction-digit metadata for an ISO 4217 currency code. */
export const currencyMinorUnitDigits = (
  currency: string,
  locale?: Intl.LocalesArgument,
): number => {
  const digits = new Intl.NumberFormat(normalizeLocales(locale), {
    currency,
    style: "currency",
  }).resolvedOptions().maximumFractionDigits
  if (digits === undefined) throw new RangeError(`Unable to determine minor units for ${currency}`)
  return digits
}

const exactDecimal = (minorUnits: number, digits: number): string => {
  const negative = minorUnits < 0
  const absolute = BigInt(negative ? -minorUnits : minorUnits)
    .toString()
    .padStart(digits + 1, "0")
  if (digits === 0) return `${negative ? "-" : ""}${absolute}`
  const whole = absolute.slice(0, -digits)
  const fraction = absolute.slice(-digits)
  return `${negative ? "-" : ""}${whole}.${fraction}`
}

/**
 * Formats an integer minor-unit value, such as 1099 cents, without floating-point conversion.
 * @throws {RangeError} For non-safe-integer values or invalid native currency options.
 */
export const formatMoney = (
  minorUnits: number,
  currency: string,
  options: MoneyFormatOptions = {},
): string => {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new RangeError("Money values must be safe integers in minor units")
  }
  const { locale, ...numberFormatOptions } = options
  const digits = currencyMinorUnitDigits(currency, locale)
  const formatter = new Intl.NumberFormat(normalizeLocales(locale), {
    ...numberFormatOptions,
    currency,
    style: "currency",
  })
  // ECMA-402 accepts decimal strings exactly; current TypeScript Intl declarations still omit them.
  const formatExact = formatter.format as unknown as (value: string) => string
  return formatExact(exactDecimal(minorUnits, digits))
}
