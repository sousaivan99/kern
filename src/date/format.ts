import { normalizeLocales } from "../intl.js"
import { assertValidDate } from "./shared.js"

/** Native date-format options with `locale` colocated for convenience. */
export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  readonly locale?: Intl.LocalesArgument
}

/** Native relative-time options with `locale` colocated for convenience. */
export interface RelativeFormatOptions extends Intl.RelativeTimeFormatOptions {
  readonly locale?: Intl.LocalesArgument
}

/** Formats a valid date with native `Intl.DateTimeFormat`. */
export const formatDate = (date: Date, options: DateFormatOptions = {}): string => {
  assertValidDate(date)
  const { locale, ...formatOptions } = options
  const resolved =
    Object.keys(formatOptions).length === 0
      ? ({ day: "numeric", month: "short", year: "numeric" } as const)
      : formatOptions
  return new Intl.DateTimeFormat(normalizeLocales(locale), resolved).format(date)
}

/** Formats a valid date and time with native `Intl.DateTimeFormat`. */
export const formatDateTime = (date: Date, options: DateFormatOptions = {}): string => {
  assertValidDate(date)
  const { locale, ...formatOptions } = options
  const resolved =
    Object.keys(formatOptions).length === 0
      ? ({ dateStyle: "medium", timeStyle: "short" } as const)
      : formatOptions
  return new Intl.DateTimeFormat(normalizeLocales(locale), resolved).format(date)
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
  const units: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_556_952],
    ["month", 2_629_746],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ]
  const [unit, divisor] = units.find(([, threshold]) => Math.abs(seconds) >= threshold) ?? [
    "second",
    1,
  ]
  const { locale, ...relativeOptions } = options
  return new Intl.RelativeTimeFormat(normalizeLocales(locale), relativeOptions).format(
    Math.round(seconds / divisor),
    unit,
  )
}

/** Returns the UTC calendar date as `YYYY-MM-DD`. */
export const toISODate = (date: Date): string => {
  assertValidDate(date)
  return date.toISOString().slice(0, 10)
}
