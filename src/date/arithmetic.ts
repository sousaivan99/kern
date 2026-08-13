import { copyDate } from "./shared.js"

const assertInteger = (amount: number): void => {
  if (!Number.isSafeInteger(amount)) throw new RangeError("Date amounts must be safe integers")
}

/** Adds local-calendar days without mutating the supplied date. */
export const addDays = (date: Date, amount: number): Date => {
  assertInteger(amount)
  const output = copyDate(date)
  output.setDate(output.getDate() + amount)
  return output
}

/** Adds local-calendar months and clamps the day at the destination month end. */
export const addMonths = (date: Date, amount: number): Date => {
  assertInteger(amount)
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

/** Adds local-calendar years and clamps leap-day inputs when necessary. */
export const addYears = (date: Date, amount: number): Date => {
  assertInteger(amount)
  return addMonths(date, amount * 12)
}
