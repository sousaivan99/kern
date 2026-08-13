import { normalizeLocales } from "../intl.js"
import { currencyMinorUnitDigits } from "./format.js"

/** Options for strict locale-aware money parsing. */
export interface MoneyParseOptions {
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

const groupingFor = (locale: Intl.LocalesArgument | undefined): Grouping => {
  const formatter = new Intl.NumberFormat(normalizeLocales(locale), {
    maximumFractionDigits: 0,
    useGrouping: true,
  })
  const integers = formatter
    .formatToParts(123_456_789_012_345)
    .filter((part) => part.type === "integer")
    .map((part) => [...part.value].length)
  const primary = integers.at(-1) ?? 3
  const secondary = integers.at(-2) ?? primary
  return { primary, secondary }
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
  const digitFormatter = new Intl.NumberFormat(normalizedLocale, {
    maximumFractionDigits: 0,
    useGrouping: false,
  })
  const digits = Array.from({ length: 10 }, (_, digit) => digitFormatter.format(digit))
  return { decimal, digits, group, grouping: groupingFor(locale) }
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
 * Fractions beyond the currency precision round half away from zero.
 * @throws {RangeError} For malformed input, invalid currency metadata, or unsafe results.
 */
export const parseMoney = (
  input: string,
  currency: string,
  options: MoneyParseOptions = {},
): number => {
  const { locale } = options
  const formatter = new Intl.NumberFormat(normalizeLocales(locale), {
    currency,
    style: "currency",
  })
  const positivePattern = moneyPattern(formatter.formatToParts(123_456_789.6))
  const negativePattern = moneyPattern(formatter.formatToParts(-123_456_789.6))
  const trimmed = input.trim()
  const negativeMatch = negativePattern.exec(trimmed)
  const positiveMatch = negativeMatch ? undefined : positivePattern.exec(trimmed)
  const matchedNumber = (negativeMatch ?? positiveMatch)?.[1]
  if (!matchedNumber) throw new RangeError("Invalid monetary value")

  const normalized = normalizeNumber(matchedNumber, localeNumberSyntax(locale))
  if (!normalized) throw new RangeError("Invalid monetary value")

  const [whole = "0", fraction = ""] = normalized.split(".")
  const digits = currencyMinorUnitDigits(currency, locale)
  const factor = 10n ** BigInt(digits)
  const kept = fraction.slice(0, digits).padEnd(digits, "0")
  let absolute = BigInt(whole) * factor + BigInt(kept || "0")
  if ((fraction[digits] ?? "0") >= "5") absolute += 1n
  const result = Number(negativeMatch ? -absolute : absolute)
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Money result exceeds the safe integer range")
  }
  return result
}
