import { assertValidDate, isValidDate as validDate } from "./shared.js"

/** Tests an untrusted value for a valid native `Date` instance. */
export const isValidDate = validDate

/** Tests whether `left` is before `right`. Native equivalent: `left.getTime() < right.getTime()`. */
export const isBefore = (left: Date, right: Date): boolean => {
  return assertValidDate(left) < assertValidDate(right)
}

/** Tests whether `left` is after `right`. Native equivalent: `left.getTime() > right.getTime()`. */
export const isAfter = (left: Date, right: Date): boolean => {
  return assertValidDate(left) > assertValidDate(right)
}

/** Tests whether two valid dates represent the same instant. */
export const isSameInstant = (left: Date, right: Date): boolean => {
  return assertValidDate(left) === assertValidDate(right)
}

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

/** Tests whether two dates fall on the same host-local calendar day. */
export const isSameDay = (left: Date, right: Date): boolean =>
  differenceInCalendarDays(left, right) === 0

/** Tests whether `date` is on the same host-local calendar day as `now`. */
export const isToday = (date: Date, now: Date = new Date()): boolean => isSameDay(date, now)

/** Tests whether `date` is one host-local calendar day after `now`. */
export const isTomorrow = (date: Date, now: Date = new Date()): boolean =>
  differenceInCalendarDays(date, now) === 1

/** Tests whether `date` is one host-local calendar day before `now`. */
export const isYesterday = (date: Date, now: Date = new Date()): boolean =>
  differenceInCalendarDays(date, now) === -1
