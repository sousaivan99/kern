import { createIntlCache, intlConfiguration, normalizeLocales } from "../intl.js"
import { type MoneyRoundingOptions, roundRatio } from "./rounding.js"
import { checkedNumber } from "./shared.js"

/** Options for strict locale-aware money parsing. */
export interface MoneyParseOptions extends MoneyRoundingOptions {
  readonly locale?: Intl.LocalesArgument
}

const escapePattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")

const literalPattern = (value: string): string => {
  let pattern = ""
  let inWhitespace = false
  for (const character of value) {
    if (/^[\s\u00a0\u202f]$/u.test(character)) {
      if (!inWhitespace) pattern += "[\\s\\u00a0\\u202f]+"
      inWhitespace = true
    } else {
      inWhitespace = false
      pattern += /^\p{Cf}$/u.test(character) ? "\\p{Cf}*" : escapePattern(character)
    }
  }
  return pattern
}

const isNumericPart = (part: Intl.NumberFormatPart): boolean =>
  part.type === "integer" ||
  part.type === "group" ||
  part.type === "decimal" ||
  part.type === "fraction"

const moneyPattern = (parts: Intl.NumberFormatPart[]): RegExp => {
  const firstNumber = parts.findIndex(isNumericPart)
  let lastNumber = parts.length - 1
  while (lastNumber >= 0 && !isNumericPart(parts[lastNumber] as Intl.NumberFormatPart)) {
    lastNumber -= 1
  }
  if (firstNumber < 0 || lastNumber < firstNumber) {
    throw new RangeError("Unable to determine the locale money pattern")
  }

  const prefix = parts
    .slice(0, firstNumber)
    .map((part) => literalPattern(part.value))
    .join("")
  const suffix = parts
    .slice(lastNumber + 1)
    .map((part) => literalPattern(part.value))
    .join("")
  return new RegExp(`^${prefix}(.+?)${suffix}$`, "u")
}

const normalizeDigitSequence = (value: string, digits: readonly string[]): string | undefined => {
  let normalized = ""
  let offset = 0
  while (offset < value.length) {
    const digit = digits.findIndex((candidate) => value.startsWith(candidate, offset))
    if (digit < 0) return undefined
    normalized += String(digit)
    offset += (digits[digit] as string).length
  }
  return normalized
}

interface Grouping {
  readonly primary: number
  readonly secondary: number
}

const validGroupedInteger = (segments: readonly string[], grouping: Grouping): boolean => {
  if (segments.length < 2) return false
  const last = segments.at(-1)
  const first = segments[0]
  if (!last || !first || last.length !== grouping.primary) return false
  if (first.length < 1 || first.length > grouping.secondary) return false
  return segments.slice(1, -1).every((segment) => segment.length === grouping.secondary)
}

const localeNumberSyntax = (locale: Intl.LocalesArgument | undefined) => {
  const normalizedLocale = normalizeLocales(locale)
  const decimalFormatter = new Intl.NumberFormat(normalizedLocale, {
    minimumFractionDigits: 1,
    useGrouping: false,
  })
  const groupedFormatter = new Intl.NumberFormat(normalizedLocale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  })
  const decimal =
    decimalFormatter.formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? "."
  const group =
    groupedFormatter.formatToParts(123_456).find((part) => part.type === "group")?.value ?? ","
  const digits = Array.from({ length: 10 }, (_, digit) => groupedFormatter.format(digit))
  const integerWidths = groupedFormatter
    .formatToParts(123_456_789_012_345)
    .filter((part) => part.type === "integer")
    .map((part) => [...part.value].length)
  const primary = integerWidths.at(-1) ?? 3
  return {
    decimal,
    digits,
    group,
    grouping: { primary, secondary: integerWidths.at(-2) ?? primary },
  }
}

interface MoneyParser {
  readonly digits: number
  readonly negativePattern: RegExp
  readonly positivePattern: RegExp
  readonly syntax: ReturnType<typeof localeNumberSyntax>
}

const moneyParsers = createIntlCache<MoneyParser>()

const createMoneyParser = (
  currency: string,
  locale: Intl.LocalesArgument | undefined,
): MoneyParser => {
  const formatter = new Intl.NumberFormat(normalizeLocales(locale), {
    currency,
    style: "currency",
  })
  const digits = formatter.resolvedOptions().maximumFractionDigits
  if (digits === undefined) throw new RangeError(`Unable to determine minor units for ${currency}`)
  return {
    digits,
    negativePattern: moneyPattern(formatter.formatToParts(-123_456_789.6)),
    positivePattern: moneyPattern(formatter.formatToParts(123_456_789.6)),
    syntax: localeNumberSyntax(locale),
  }
}

const moneyParser = (
  currency: string,
  locale: Intl.LocalesArgument | undefined,
  options: MoneyParseOptions,
): MoneyParser => {
  if (moneyParsers.bypass()) return createMoneyParser(currency, locale)
  const configuration = typeof currency === "string" ? intlConfiguration(options) : undefined
  if (!configuration) return createMoneyParser(currency, locale)
  return moneyParsers.get(JSON.stringify([currency, configuration.locale]), () =>
    createMoneyParser(currency, configuration.locale),
  )
}

const normalizeNumber = (
  value: string,
  syntax: ReturnType<typeof localeNumberSyntax>,
): string | undefined => {
  const decimalIndex = value.indexOf(syntax.decimal)
  if (decimalIndex !== value.lastIndexOf(syntax.decimal)) return undefined

  const integerText = decimalIndex < 0 ? value : value.slice(0, decimalIndex)
  const fractionText =
    decimalIndex < 0 ? undefined : value.slice(decimalIndex + syntax.decimal.length)
  if (integerText.length === 0 || fractionText === "") return undefined

  const localizedSegments = integerText.split(syntax.group)
  const segments = localizedSegments.map((segment) =>
    normalizeDigitSequence(segment, syntax.digits),
  )
  if (segments.some((segment) => segment === undefined)) return undefined
  const normalizedSegments = segments as string[]
  if (localizedSegments.length > 1 && !validGroupedInteger(normalizedSegments, syntax.grouping)) {
    return undefined
  }

  const fraction =
    fractionText === undefined ? undefined : normalizeDigitSequence(fractionText, syntax.digits)
  if (fractionText !== undefined && fraction === undefined) return undefined
  return `${normalizedSegments.join("")}${fraction === undefined ? "" : `.${fraction}`}`
}

/**
 * Parses a strictly locale-formatted currency value into integer minor units.
 * The selected currency marker is required and grouping, when present, must match the locale.
 * Fractions beyond the currency precision use the selected exact rounding mode.
 * @throws {RangeError} For malformed input, invalid currency metadata, or unsafe results.
 */
export const parseMoney = (
  input: string,
  currency: string,
  options: MoneyParseOptions = {},
): number => {
  const { locale } = options
  const { digits, negativePattern, positivePattern, syntax } = moneyParser(
    currency,
    locale,
    options,
  )
  const trimmed = input.trim()
  const negativeMatch = negativePattern.exec(trimmed)
  const positiveMatch = negativeMatch ? undefined : positivePattern.exec(trimmed)
  const matchedNumber = (negativeMatch ?? positiveMatch)?.[1]
  const normalized = matchedNumber ? normalizeNumber(matchedNumber, syntax) : undefined
  if (!normalized) throw new RangeError("Invalid monetary value")

  const [whole = "0", fraction = ""] = normalized.split(".")
  const factor = 10n ** BigInt(digits)
  const denominator = 10n ** BigInt(fraction.length)
  const absoluteNumerator = BigInt(`${whole}${fraction}` || "0") * factor
  const signedNumerator = negativeMatch ? -absoluteNumerator : absoluteNumerator
  return checkedNumber(roundRatio(signedNumerator, denominator, options))
}
