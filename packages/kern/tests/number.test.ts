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
    expect(round(1.255, 2)).toBe(1.26)
    expect(round(10.075, 2)).toBe(10.08)
    expect(round(-10.075, 2)).toBe(-10.07)
    expect(round(123_456_789.124_999_9, 2)).toBe(123_456_789.12)
    expect(round(1.234, 2)).toBe(1.23)
    expect(round(0.001, 2)).toBe(0)
    expect(round(1234, -2)).toBe(1200)
    expect(round(1250, -2)).toBe(1300)
    expect(round(1.234_567_89, 16)).toBe(1.234_567_89)
    expect(Object.is(round(-0.1), -0)).toBe(false)
    expect(isBetween(2, 1, 3)).toBe(true)
    expect(isBetween(1, 1, 3, { inclusive: false })).toBe(false)
    expect(percentageOfTotal(1, 4)).toBe(25)
    expect(() => percentageOfTotal(1, 0)).toThrow(RangeError)
    expect(() => percentageOfTotal(Number.POSITIVE_INFINITY, 1)).toThrow(RangeError)
    expect(() => clamp(1, Number.NaN, 2)).toThrow(RangeError)
    expect(round(Number.NaN)).toBeNaN()
    expect(round(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
    expect(() => round(1, 1.5)).toThrow(RangeError)
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

  test("keeps the two-decimal fast path equivalent to decimal exponent shifting", () => {
    const shift = (value: number, places: number): number => {
      const [coefficient, exponent = "0"] = value.toString().split("e")
      return Number(`${coefficient}e${Number(exponent) + places}`)
    }
    let state = 0x9e37_79b9
    for (let index = 0; index < 10_000; index += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      const value = (state / 0x1_0000_0000 - 0.5) * 1_999_999_998
      const expected = shift(Math.round(shift(value, 2)), -2)
      expect(round(value, 2)).toBe(expected === 0 ? 0 : expected)
    }
  })

  test("re-reads cacheable options and bypasses observable option objects", () => {
    const mutable = { locale: "en-US", maximumFractionDigits: 0 }
    expect(formatNumber(1.25, mutable)).toBe("1")
    mutable.maximumFractionDigits = 2
    expect(formatNumber(1.25, mutable)).toBe("1.25")

    let digits = 0
    let reads = 0
    const accessor = {
      locale: "en-US",
      get maximumFractionDigits() {
        reads += 1
        return digits
      },
    }
    expect(formatNumber(1.25, accessor)).toBe("1")
    digits = 2
    expect(formatNumber(1.25, accessor)).toBe("1.25")
    expect(reads).toBe(2)

    const backing = { locale: "en-US", maximumFractionDigits: 0 }
    const transparent = new Proxy(backing, {})
    expect(formatNumber(1.25, transparent)).toBe("1")
    backing.maximumFractionDigits = 2
    expect(formatNumber(1.25, transparent)).toBe("1.25")

    for (let index = 0; index < 33; index += 1) {
      expect(
        formatNumber(1.25, {
          locale: `en-US-x-cache${index}`,
          maximumFractionDigits: index % 3,
        }),
      ).toBeTypeOf("string")
    }
    expect(formatNumber(1.25, mutable)).toBe("1.25")
  })
})
