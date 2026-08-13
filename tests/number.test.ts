import { describe, expect, test } from "bun:test"
import {
  calculatePercentage,
  clamp,
  formatCompact,
  formatPercent,
  isBetween,
  round,
} from "../src/number/index.js"

describe("number", () => {
  test("supports numeric calculations", () => {
    expect(clamp(12, 0, 10)).toBe(10)
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(1250, -2)).toBe(1300)
    expect(isBetween(2, 1, 3)).toBe(true)
    expect(isBetween(1, 1, 3, false)).toBe(false)
    expect(calculatePercentage(1, 4)).toBe(25)
    expect(() => calculatePercentage(1, 0)).toThrow(RangeError)
    expect(() => calculatePercentage(Number.POSITIVE_INFINITY, 1)).toThrow(RangeError)
    expect(() => clamp(1, Number.NaN, 2)).toThrow(RangeError)
    expect(round(Number.NaN)).toBeNaN()
    expect(round(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
  })

  test("uses Intl for formatting", () => {
    expect(formatCompact(1200, { locale: "en-US" })).toBe("1.2K")
    expect(formatPercent(0.25, { locale: "en-US" })).toBe("25%")
  })
})
