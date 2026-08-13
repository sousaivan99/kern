import { assertValidDate } from "./shared.js"

const calendarStamp = (date: Date): number => {
  assertValidDate(date)
  const stamp = new Date(0)
  stamp.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate())
  stamp.setUTCHours(0, 0, 0, 0)
  return stamp.getTime()
}

/** Returns local-calendar-day difference (`left - right`), ignoring time-of-day and DST. */
export const differenceInCalendarDays = (left: Date, right: Date): number =>
  Math.round((calendarStamp(left) - calendarStamp(right)) / 86_400_000)

/** Tests whether `date` is on the same host-local calendar day as `now`. */
export const isToday = (date: Date, now: Date = new Date()): boolean =>
  differenceInCalendarDays(date, now) === 0

/** Tests whether `date` is one host-local calendar day after `now`. */
export const isTomorrow = (date: Date, now: Date = new Date()): boolean =>
  differenceInCalendarDays(date, now) === 1

/** Tests whether `date` is one host-local calendar day before `now`. */
export const isYesterday = (date: Date, now: Date = new Date()): boolean =>
  differenceInCalendarDays(date, now) === -1
