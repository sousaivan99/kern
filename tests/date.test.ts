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
  isToday,
  isTomorrow,
  isYesterday,
  startOfDay,
  toISODate,
} from "../src/date/index.js"

describe("date", () => {
  test("performs non-mutating local calendar arithmetic", () => {
    const original = new Date(2024, 0, 31, 12, 30)
    expect(addDays(original, 1).getDate()).toBe(1)
    expect(addMonths(original, 1).getDate()).toBe(29)
    expect(addYears(new Date(2024, 1, 29), 1).getDate()).toBe(28)
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
    expect(base.getTime() < tomorrow.getTime()).toBe(true)
    expect(differenceInCalendarDays(tomorrow, base)).toBe(1)
    expect(isToday(new Date(2024, 0, 10, 1), base)).toBe(true)
    expect(isTomorrow(tomorrow, base)).toBe(true)
    expect(isYesterday(yesterday, base)).toBe(true)
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
    expect(toISODate(date)).toBe("2024-01-02")
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
