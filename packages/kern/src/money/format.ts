import { createIntlCache, intlConfiguration, normalizeLocales } from "../intl.js"
import { assertMinorUnits } from "./shared.js"

/** Native number-format options with `locale` colocated; currency and style are fixed by Kern. */
export interface MoneyFormatOptions extends Omit<Intl.NumberFormatOptions, "currency" | "style"> {
  readonly locale?: Intl.LocalesArgument
}

interface CurrencyFormatter {
  readonly digits: number
  readonly formatter: Intl.NumberFormat
}

const currencyFormats = createIntlCache<CurrencyFormatter>()

const createCurrencyFormatter = (
  currency: string,
  locale: string | string[] | undefined,
  options: Intl.NumberFormatOptions,
): CurrencyFormatter => {
  const formatter = new Intl.NumberFormat(locale, { ...options, currency, style: "currency" })
  const digits = formatter.resolvedOptions().maximumFractionDigits
  if (digits === undefined) throw new RangeError(`Unable to determine minor units for ${currency}`)
  return { digits, formatter }
}

const currencyFormatter = (currency: string, options: MoneyFormatOptions): CurrencyFormatter => {
  if (currencyFormats.bypass()) {
    const { locale, ...formatOptions } = options
    return createCurrencyFormatter(currency, normalizeLocales(locale), formatOptions)
  }
  const configuration = typeof currency === "string" ? intlConfiguration(options) : undefined
  if (!configuration) {
    const { locale, ...formatOptions } = options
    return createCurrencyFormatter(currency, normalizeLocales(locale), formatOptions)
  }
  return currencyFormats.get(JSON.stringify([currency, configuration.key]), () =>
    createCurrencyFormatter(currency, configuration.locale, configuration.options),
  )
}

/** Returns the native `Intl` fraction-digit metadata for an ISO 4217 currency code. */
export const currencyMinorUnitDigits = (currency: string, locale?: Intl.LocalesArgument): number =>
  currencyFormatter(currency, { locale }).digits

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
  assertMinorUnits(minorUnits)
  const { digits, formatter } = currencyFormatter(currency, options)
  // ECMA-402 accepts decimal strings exactly; current TypeScript Intl declarations still omit them.
  const formatExact = formatter.format as unknown as (value: string) => string
  return formatExact(exactDecimal(minorUnits, digits))
}
