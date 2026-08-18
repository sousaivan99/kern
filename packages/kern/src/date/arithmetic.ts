import { assertValidDate } from "./shared.js"
import { addWithTemporal } from "./temporal.js"

const assertInteger = (amount: number): void => {
  if (!Number.isSafeInteger(amount)) throw new RangeError("Date amounts must be safe integers")
}

const daysInMonth = (year: number, month: number): number => {
  if (month === 1) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  }
  return month === 3 || month === 5 || month === 8 || month === 10 ? 30 : 31
}

/** Adds local-calendar days without mutating the supplied date. */
export const addDays = (date: Date, amount: number): Date => {
  assertInteger(amount)
  const timestamp = assertValidDate(date)
  const temporal = addWithTemporal(date, { days: amount })
  if (temporal) return temporal
  const output = new Date(timestamp)
  output.setDate(output.getDate() + amount)
  return output
}

/** Subtracts local-calendar days without mutating the supplied date. */
export const subtractDays = (date: Date, amount: number): Date => addDays(date, -amount)

/** Adds local-calendar months and clamps the day at the destination month end. */
export const addMonths = (date: Date, amount: number): Date => {
  assertInteger(amount)
  const timestamp = assertValidDate(date)
  const temporal = addWithTemporal(date, { months: amount })
  if (temporal) return temporal
  const output = new Date(timestamp)
  const day = output.getDate()
  const monthIndex = output.getMonth() + amount
  const yearOffset = Math.floor(monthIndex / 12)
  const month = monthIndex - yearOffset * 12
  const year = output.getFullYear() + yearOffset
  output.setFullYear(year, month, Math.min(day, daysInMonth(year, month)))
  return output
}

/** Subtracts local-calendar months with the same month-end clamping as `addMonths`. */
export const subtractMonths = (date: Date, amount: number): Date => addMonths(date, -amount)

/** Adds local-calendar years and clamps leap-day inputs when necessary. */
export const addYears = (date: Date, amount: number): Date => {
  assertInteger(amount)
  assertInteger(amount * 12)
  return addMonths(date, amount * 12)
}

/** Subtracts local-calendar years with the same leap-day clamping as `addYears`. */
export const subtractYears = (date: Date, amount: number): Date => addYears(date, -amount)
