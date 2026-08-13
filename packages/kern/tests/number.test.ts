import { describe, expect, test } from "bun:test"
import {
  clamp,
  formatCompact,
  formatNumber,
  formatPercentage,
  isBetween,
  percentageOfTotal,
  round,
} from "../src/number/index.js"

describe("number", () => {
  test("supports numeric calculations", () => {
    expect(clamp(12, 0, 10)).toBe(10)
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(1250, -2)).toBe(1300)
    expect(isBetween(2, 1, 3)).toBe(true)
    expect(isBetween(1, 1, 3, { inclusive: false })).toBe(false)
    expect(percentageOfTotal(1, 4)).toBe(25)
    expect(() => percentageOfTotal(1, 0)).toThrow(RangeError)
    expect(() => percentageOfTotal(Number.POSITIVE_INFINITY, 1)).toThrow(RangeError)
    expect(() => clamp(1, Number.NaN, 2)).toThrow(RangeError)
    expect(round(Number.NaN)).toBeNaN()
    expect(round(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
  })

  test("uses Intl for formatting", () => {
    expect(formatNumber(1_234_567.89, { locale: "de-DE" })).toBe("1.234.567,89")
    expect(
      formatNumber(12.5, {
        locale: "en-US",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        useGrouping: false,
      }),
    ).toBe("12.50")
    expect(formatCompact(1200, { locale: "en-US" })).toBe("1.2K")
    expect(formatPercentage(percentageOfTotal(1, 4), { locale: "en-US" })).toBe("25%")
  })
})
