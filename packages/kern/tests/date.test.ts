import { describe, expect, test } from "bun:test"
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  endOfDay,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  isAfter,
  isBefore,
  isSameDay,
  isSameInstant,
  isToday,
  isTomorrow,
  isValidDate,
  isYesterday,
  startOfDay,
  subtractDays,
  subtractMonths,
  subtractYears,
  toUTCISODate,
} from "../src/date/index.js"

describe("date", () => {
  test("uses a complete global Temporal implementation and falls back from hostile globals", () => {
    interface Duration {
      readonly days?: number
      readonly milliseconds?: number
      readonly months?: number
      readonly years?: number
    }

    const addMonthsReference = (date: Date, amount: number): Date => {
      const output = new Date(date.getTime())
      const day = output.getDate()
      output.setDate(1)
      output.setMonth(output.getMonth() + amount)
      const monthEnd = new Date(output.getTime())
      monthEnd.setMonth(monthEnd.getMonth() + 1, 0)
      output.setDate(Math.min(day, monthEnd.getDate()))
      return output
    }

    class TestZonedDateTime {
      readonly #date: Date

      constructor(epochMilliseconds: number) {
        this.#date = new Date(epochMilliseconds)
      }

      get epochMilliseconds(): number {
        return this.#date.getTime()
      }

      add(duration: Duration): TestZonedDateTime {
        let output = new Date(this.#date.getTime())
        if (duration.years) output = addMonthsReference(output, duration.years * 12)
        if (duration.months) output = addMonthsReference(output, duration.months)
        if (duration.days) output.setDate(output.getDate() + duration.days)
        if (duration.milliseconds) {
          output.setTime(output.getTime() + duration.milliseconds)
        }
        return new TestZonedDateTime(output.getTime())
      }

      subtract(duration: Duration): TestZonedDateTime {
        return this.add({
          ...(duration.days === undefined ? {} : { days: -duration.days }),
          ...(duration.milliseconds === undefined ? {} : { milliseconds: -duration.milliseconds }),
          ...(duration.months === undefined ? {} : { months: -duration.months }),
          ...(duration.years === undefined ? {} : { years: -duration.years }),
        })
      }

      startOfDay(): TestZonedDateTime {
        const output = new Date(this.#date.getTime())
        output.setHours(0, 0, 0, 0)
        return new TestZonedDateTime(output.getTime())
      }
    }

    const temporalGlobal = globalThis as { Temporal?: unknown }
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Temporal")
    let calls = 0
    Object.defineProperty(temporalGlobal, "Temporal", {
      configurable: true,
      value: {
        Instant: {
          fromEpochMilliseconds(epochMilliseconds: number) {
            calls += 1
            return {
              toZonedDateTimeISO() {
                return new TestZonedDateTime(epochMilliseconds)
              },
            }
          },
        },
        Now: {
          timeZoneId() {
            calls += 1
            return "Test/Local"
          },
        },
      },
      writable: true,
    })

    const input = new Date(2024, 0, 31, 12, 30)
    try {
      expect(addDays(input, 1).getTime()).toBe(new Date(2024, 1, 1, 12, 30).getTime())
      expect(addMonths(input, 1).getTime()).toBe(new Date(2024, 1, 29, 12, 30).getTime())
      expect(addYears(input, 1).getTime()).toBe(new Date(2025, 0, 31, 12, 30).getTime())
      expect(startOfDay(input).getHours()).toBe(0)
      expect(endOfDay(input).getTime() - startOfDay(input).getTime()).toBe(86_399_999)
      expect(calls).toBeGreaterThan(0)
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, "Temporal", originalDescriptor)
      else Reflect.deleteProperty(globalThis, "Temporal")
    }

    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error("hostile Temporal global")
        },
      },
    )
    Object.defineProperty(temporalGlobal, "Temporal", {
      configurable: true,
      value: hostile,
      writable: true,
    })
    try {
      expect(addDays(input, 1).getTime()).toBe(new Date(2024, 1, 1, 12, 30).getTime())
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, "Temporal", originalDescriptor)
      else Reflect.deleteProperty(globalThis, "Temporal")
    }
  })

  test("performs non-mutating local calendar arithmetic", () => {
    const original = new Date(2024, 0, 31, 12, 30)
    expect(addDays(original, 1).getDate()).toBe(1)
    expect(addMonths(original, 1).getDate()).toBe(29)
    expect(addYears(new Date(2024, 1, 29), 1).getDate()).toBe(28)
    expect(subtractDays(new Date(2024, 1, 1), 1).getDate()).toBe(31)
    expect(subtractMonths(new Date(2024, 2, 31), 1).getDate()).toBe(29)
    expect(subtractYears(new Date(2024, 1, 29), 1).getDate()).toBe(28)
    expect(original).toEqual(new Date(2024, 0, 31, 12, 30))
  })

  test("creates day boundaries without mutation", () => {
    const date = new Date(2024, 5, 10, 12, 34, 56, 789)
    expect(startOfDay(date).getHours()).toBe(0)
    expect(endOfDay(date).getTime() - startOfDay(date).getTime()).toBe(86_399_999)
    expect(date.getHours()).toBe(12)
  })

  test("compares instants and local calendar days", () => {
    const base = new Date(2024, 0, 10, 23)
    const tomorrow = new Date(2024, 0, 11, 1)
    const yesterday = new Date(2024, 0, 9, 12)
    const baseTime = base.getTime()
    expect(isBefore(base, tomorrow)).toBe(true)
    expect(isAfter(tomorrow, base)).toBe(true)
    expect(isBefore(base, new Date(baseTime))).toBe(false)
    expect(isAfter(base, new Date(baseTime))).toBe(false)
    expect(isSameInstant(base, new Date(baseTime))).toBe(true)
    expect(isSameDay(base, new Date(2024, 0, 10, 1))).toBe(true)
    expect(isSameDay(base, tomorrow)).toBe(false)
    expect(base.getTime()).toBe(baseTime)
    expect(differenceInCalendarDays(tomorrow, base)).toBe(1)
    expect(isToday(new Date(2024, 0, 10, 1), base)).toBe(true)
    expect(isTomorrow(tomorrow, base)).toBe(true)
    expect(isYesterday(yesterday, base)).toBe(true)
  })

  test("rejects invalid dates when comparing instants", () => {
    const invalid = new Date(Number.NaN)
    expect(isValidDate(new Date())).toBe(true)
    expect(isValidDate(invalid)).toBe(false)
    expect(isValidDate("2024-01-01")).toBe(false)
    expect(() => isBefore(invalid, new Date())).toThrow(RangeError)
    expect(() => isAfter(new Date(), invalid)).toThrow(RangeError)
    expect(() => isSameInstant(new Date(), invalid)).toThrow(RangeError)
    expect(() => isSameDay(invalid, new Date())).toThrow(RangeError)
  })

  test("formats with explicit locale and timezone", () => {
    const date = new Date("2024-01-02T03:04:00.000Z")
    expect(formatDate(date, { locale: "en-US", timeZone: "UTC", dateStyle: "long" })).toBe(
      "January 2, 2024",
    )
    expect(
      formatDateTime(date, { locale: "en-US", timeZone: "UTC", timeStyle: "short" }),
    ).toContain("3:04 AM")
    expect(
      formatRelativeTime(new Date("2024-01-03T00:00:00Z"), new Date("2024-01-02T00:00:00Z"), {
        locale: "en",
        numeric: "always",
      }),
    ).toBe("in 1 day")
    expect(toUTCISODate(date)).toBe("2024-01-02")
  })

  test("handles local-calendar years from 0 through 99 without 1900 remapping", () => {
    const createLocalDate = (year: number, month: number, day: number): Date => {
      const date = new Date(0)
      date.setFullYear(year, month, day)
      date.setHours(12, 0, 0, 0)
      return date
    }

    const year99 = createLocalDate(99, 11, 31)
    const year100 = createLocalDate(100, 0, 1)
    expect(differenceInCalendarDays(year100, year99)).toBe(1)
    expect(addMonths(createLocalDate(0, 0, 31), 1).getDate()).toBe(29)
  })
})
