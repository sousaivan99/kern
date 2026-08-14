import { assertValidDate, copyDate } from "./shared.js"
import { addWithTemporal } from "./temporal.js"

const assertInteger = (amount: number): void => {
  if (!Number.isSafeInteger(amount)) throw new RangeError("Date amounts must be safe integers")
}

/** Adds local-calendar days without mutating the supplied date. */
export const addDays = (date: Date, amount: number): Date => {
  assertInteger(amount)
  assertValidDate(date)
  const temporal = addWithTemporal(date, { days: amount })
  if (temporal) return temporal
  const output = copyDate(date)
  output.setDate(output.getDate() + amount)
  return output
}

/** Subtracts local-calendar days without mutating the supplied date. */
export const subtractDays = (date: Date, amount: number): Date => addDays(date, -amount)

/** Adds local-calendar months and clamps the day at the destination month end. */
export const addMonths = (date: Date, amount: number): Date => {
  assertInteger(amount)
  assertValidDate(date)
  const temporal = addWithTemporal(date, { months: amount })
  if (temporal) return temporal
  const output = copyDate(date)
  const day = output.getDate()
  output.setDate(1)
  output.setMonth(output.getMonth() + amount)
  const monthEnd = copyDate(output)
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0)
  const lastDay = monthEnd.getDate()
  output.setDate(Math.min(day, lastDay))
  return output
}

/** Subtracts local-calendar months with the same month-end clamping as `addMonths`. */
export const subtractMonths = (date: Date, amount: number): Date => addMonths(date, -amount)

/** Adds local-calendar years and clamps leap-day inputs when necessary. */
export const addYears = (date: Date, amount: number): Date => {
  assertInteger(amount)
  assertInteger(amount * 12)
  assertValidDate(date)
  const temporal = addWithTemporal(date, { years: amount })
  if (temporal) return temporal
  return addMonths(date, amount * 12)
}

/** Subtracts local-calendar years with the same leap-day clamping as `addYears`. */
export const subtractYears = (date: Date, amount: number): Date => addYears(date, -amount)
