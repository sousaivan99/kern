import { expect, test } from "bun:test"
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  endOfDay,
  startOfDay,
} from "../src/date/index.js"
import { checkProperty } from "./support/property.js"

const fixedTransitionDates = [
  new Date(2024, 2, 10, 12, 30, 15, 250),
  new Date(2024, 2, 31, 12, 30, 15, 250),
  new Date(2024, 3, 7, 12, 30, 15, 250),
  new Date(2024, 9, 6, 12, 30, 15, 250),
  new Date(2024, 9, 27, 12, 30, 15, 250),
  new Date(2024, 10, 3, 12, 30, 15, 250),
] as const

const monthEnd = (year: number, month: number): number => new Date(year, month + 1, 0).getDate()

const referenceAddDays = (date: Date, amount: number): Date => {
  const output = new Date(date.getTime())
  output.setDate(output.getDate() + amount)
  return output
}

const referenceAddMonths = (date: Date, amount: number): Date => {
  const output = new Date(date.getTime())
  const day = output.getDate()
  output.setDate(1)
  output.setMonth(output.getMonth() + amount)
  output.setDate(Math.min(day, monthEnd(output.getFullYear(), output.getMonth())))
  return output
}

test("property: local-calendar arithmetic handles DST and month ends without mutation", () => {
  checkProperty(
    "DST and month-end date arithmetic",
    (random, index) => {
      const generated = new Date(
        random.integer(1990, 2040),
        random.integer(0, 11),
        28,
        12,
        random.integer(0, 59),
        random.integer(0, 59),
        random.integer(0, 999),
      )
      generated.setDate(
        monthEnd(generated.getFullYear(), generated.getMonth()) - random.integer(0, 3),
      )
      return {
        date:
          index % 4 === 0
            ? new Date(
                fixedTransitionDates[index % fixedTransitionDates.length]?.getTime() ??
                  generated.getTime(),
              )
            : generated,
        dayAmount: random.integer(-60, 60),
        monthAmount: random.integer(-24, 24),
        yearAmount: random.integer(-5, 5),
      }
    },
    ({ date, dayAmount, monthAmount, yearAmount }) => {
      const originalTime = date.getTime()
      const addedDays = addDays(date, dayAmount)
      const addedMonths = addMonths(date, monthAmount)
      const addedYears = addYears(date, yearAmount)

      expect(date.getTime()).toBe(originalTime)
      expect(addedDays.getTime()).toBe(referenceAddDays(date, dayAmount).getTime())
      expect(differenceInCalendarDays(addedDays, date)).toBe(dayAmount)
      expect(addedMonths.getTime()).toBe(referenceAddMonths(date, monthAmount).getTime())
      expect(addedYears.getTime()).toBe(referenceAddMonths(date, yearAmount * 12).getTime())

      const start = startOfDay(date)
      const end = endOfDay(date)
      const referenceStart = new Date(date.getTime())
      referenceStart.setHours(0, 0, 0, 0)
      const referenceEnd = new Date(date.getTime())
      referenceEnd.setHours(23, 59, 59, 999)
      expect(start.getTime()).toBe(referenceStart.getTime())
      expect(end.getTime()).toBe(referenceEnd.getTime())
      expect(start.getTime()).toBeLessThanOrEqual(originalTime)
      expect(end.getTime()).toBeGreaterThanOrEqual(originalTime)
      expect(end.getTime() - start.getTime()).toBeGreaterThan(0)
    },
  )
})
