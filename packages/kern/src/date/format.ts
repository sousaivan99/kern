import { createIntlCache, intlConfiguration, normalizeLocales } from "../intl.js"
import { assertValidDate } from "./shared.js"

/** Native date-format options with `locale` colocated for convenience. */
export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  readonly locale?: Intl.LocalesArgument
}

/** Native relative-time options with `locale` colocated for convenience. */
export interface RelativeFormatOptions extends Intl.RelativeTimeFormatOptions {
  readonly locale?: Intl.LocalesArgument
}

const dateFormats = createIntlCache<Intl.DateTimeFormat>()
const relativeFormats = createIntlCache<Intl.RelativeTimeFormat>()
const relativeUnits: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_556_952],
  ["month", 2_629_746],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
]

const nativeDateFormatter = (
  options: DateFormatOptions,
  defaults: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat => {
  const { locale, ...formatOptions } = options
  return new Intl.DateTimeFormat(
    normalizeLocales(locale),
    Object.keys(formatOptions).length === 0 ? defaults : formatOptions,
  )
}

const dateFormatter = (
  options: DateFormatOptions,
  defaults: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat => {
  if (dateFormats.bypass()) return nativeDateFormatter(options, defaults)
  const configuration = intlConfiguration(options)
  if (configuration) {
    const resolved =
      Object.keys(configuration.options).length === 0 ? defaults : configuration.options
    if (typeof resolved.timeZone === "string") {
      return dateFormats.get(
        configuration.key,
        () => new Intl.DateTimeFormat(configuration.locale, resolved),
      )
    }
  }

  return nativeDateFormatter(options, defaults)
}

/** Formats a valid date with native `Intl.DateTimeFormat`. */
export const formatDate = (date: Date, options: DateFormatOptions = {}): string => {
  assertValidDate(date)
  return dateFormatter(options, { day: "numeric", month: "short", year: "numeric" }).format(date)
}

/** Formats a valid date and time with native `Intl.DateTimeFormat`. */
export const formatDateTime = (date: Date, options: DateFormatOptions = {}): string => {
  assertValidDate(date)
  return dateFormatter(options, { dateStyle: "medium", timeStyle: "short" }).format(date)
}

/**
 * Formats an instant relative to `baseDate`.
 * Month and year selection uses average Gregorian durations and is approximate.
 */
export const formatRelativeTime = (
  date: Date,
  baseDate: Date = new Date(),
  options: RelativeFormatOptions = {},
): string => {
  assertValidDate(date)
  assertValidDate(baseDate)
  const seconds = (date.getTime() - baseDate.getTime()) / 1_000
  const [unit, divisor] = relativeUnits.find(([, threshold]) => Math.abs(seconds) >= threshold) ?? [
    "second",
    1,
  ]
  const { locale, ...relativeOptions } = options
  const configuration = relativeFormats.bypass() ? undefined : intlConfiguration(options)
  const formatter = configuration
    ? relativeFormats.get(
        configuration.key,
        () => new Intl.RelativeTimeFormat(configuration.locale, configuration.options),
      )
    : new Intl.RelativeTimeFormat(normalizeLocales(locale), relativeOptions)
  return formatter.format(Math.round(seconds / divisor), unit)
}

/** Returns the UTC calendar date as `YYYY-MM-DD`. */
export const toUTCISODate = (date: Date): string => {
  assertValidDate(date)
  return date.toISOString().slice(0, 10)
}
