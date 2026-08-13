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
