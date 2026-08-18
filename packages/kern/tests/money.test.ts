import { describe, expect, test } from "bun:test"
import {
  addMoney,
  allocateMoney,
  applyDiscount,
  currencyMinorUnitDigits,
  formatMoney,
  multiplyMoney,
  parseMoney,
  percentageOf,
  roundMoney,
  subtractMoney,
  sumMoney,
} from "../src/money/index.js"

describe("money", () => {
  test("formats integer minor units using currency metadata", () => {
    expect(formatMoney(1099, "EUR", { locale: "en-US" })).toBe("€10.99")
    expect(formatMoney(-1099, "USD", { locale: "en-US" })).toBe("-$10.99")
    expect(formatMoney(1099, "JPY", { locale: "en-US" })).toBe("¥1,099")
    expect(currencyMinorUnitDigits("KWD", "en-US")).toBe(3)
    expect(formatMoney(Number.MAX_SAFE_INTEGER, "USD", { locale: "en-US" })).toBe(
      "$90,071,992,547,409.91",
    )
  })

  test("strictly parses localized currency strings and rounds to minor units", () => {
    expect(parseMoney("$10.99", "USD", { locale: "en-US" })).toBe(1099)
    expect(parseMoney("10,99 €", "EUR", { locale: "de-DE" })).toBe(1099)
    expect(parseMoney("-$1.235", "USD", { locale: "en-US" })).toBe(-124)
    expect(parseMoney("¥1,099", "JPY", { locale: "en-US" })).toBe(1099)
    expect(() => parseMoney("not money", "USD", { locale: "en-US" })).toThrow(RangeError)
    expect(() => parseMoney("10.99", "USD", { locale: "en-US" })).toThrow(RangeError)
    expect(() => parseMoney("USD 10.99", "USD", { locale: "en-US" })).toThrow(RangeError)
    expect(() => parseMoney("$1,2,3.00", "USD", { locale: "en-US" })).toThrow(RangeError)
    expect(() => parseMoney("$90,071,992,547,409.92", "USD", { locale: "en-US" })).toThrow(
      RangeError,
    )
  })

  test("round-trips exact values across currencies, locales, and numbering systems", () => {
    const cases = [
      [Number.MAX_SAFE_INTEGER, "USD", "en-US"],
      [-123_456_789, "EUR", "de-DE"],
      [123_456_789, "INR", "hi-IN"],
      [123_456, "EGP", "ar-EG"],
      [10_999, "KWD", "en-US"],
      [1_099, "JPY", "ja-JP"],
    ] as const
    for (const [minorUnits, currency, locale] of cases) {
      const formatted = formatMoney(minorUnits, currency, { locale })
      expect(parseMoney(formatted, currency, { locale })).toBe(minorUnits)
    }
  })

  test("re-reads cacheable money options and bypasses accessors", () => {
    const formatOptions: {
      currencyDisplay: Intl.NumberFormatOptions["currencyDisplay"]
      locale: string
    } = { currencyDisplay: "code", locale: "en-US" }
    const code = formatMoney(1099, "USD", formatOptions)
    formatOptions.currencyDisplay = "name"
    expect(formatMoney(1099, "USD", formatOptions)).not.toBe(code)

    const parseOptions: { locale: string } = { locale: "en-US" }
    expect(parseMoney("$10.99", "USD", parseOptions)).toBe(1099)
    parseOptions.locale = "de-DE"
    expect(parseMoney("10,99 $", "USD", parseOptions)).toBe(1099)

    let locale = "en-US"
    let reads = 0
    const accessor = {
      get locale() {
        reads += 1
        return locale
      },
    }
    expect(formatMoney(1099, "USD", accessor)).toBe("$10.99")
    locale = "de-DE"
    expect(formatMoney(1099, "USD", accessor)).toContain("10,99")
    expect(reads).toBe(2)

    for (let index = 0; index < 33; index += 1) {
      expect(formatMoney(1099, "USD", { locale: `en-US-x-money${index}` })).toBeTypeOf("string")
      expect(parseMoney("$10.99", "USD", { locale: `en-US-x-money-parse${index}` })).toBe(1099)
    }
  })

  test("uses checked integer arithmetic", () => {
    expect(addMoney(100, 25)).toBe(125)
    expect(subtractMoney(100, 25)).toBe(75)
    expect(sumMoney([100, 25, -10])).toBe(115)
    expect(sumMoney([])).toBe(0)
    expect(multiplyMoney(101, 1.5)).toBe(152)
    expect(multiplyMoney(-101, 1.5)).toBe(-152)
    expect(multiplyMoney(-100, 1.15)).toBe(-115)
    expect(multiplyMoney(100, 1.005)).toBe(101)
    expect(multiplyMoney(1, 2.5)).toBe(3)
    expect(multiplyMoney(-1, 2.5)).toBe(-3)
    expect(percentageOf(999, 15)).toBe(150)
    expect(applyDiscount(999, 15)).toBe(849)
    expect(() => addMoney(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError)
    expect(() => sumMoney([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError)
  })

  test("implements every rounding mode for positive and negative values", () => {
    const cases = [
      ["ceil", [2, 2, 2], [-1, -1, -1]],
      ["expand", [2, 2, 2], [-2, -2, -2]],
      ["floor", [1, 1, 1], [-2, -2, -2]],
      ["halfCeil", [1, 2, 2], [-1, -2, -1]],
      ["halfEven", [1, 2, 2], [-1, -2, -2]],
      ["halfExpand", [1, 2, 2], [-1, -2, -2]],
      ["halfFloor", [1, 2, 1], [-1, -2, -2]],
      ["halfTrunc", [1, 2, 1], [-1, -2, -1]],
      ["trunc", [1, 1, 1], [-1, -1, -1]],
    ] as const

    for (const [roundingMode, positive, negative] of cases) {
      expect([1.4, 1.6, 1.5].map((factor) => multiplyMoney(1, factor, { roundingMode }))).toEqual([
        ...positive,
      ])
      expect([1.4, 1.6, 1.5].map((factor) => multiplyMoney(-1, factor, { roundingMode }))).toEqual([
        ...negative,
      ])
    }
    expect(multiplyMoney(1, 2.5, { roundingMode: "halfEven" })).toBe(2)
    expect(multiplyMoney(1, 3.5, { roundingMode: "halfEven" })).toBe(4)
  })

  test("rounds to arbitrary minor-unit increments", () => {
    expect(roundMoney(102, { roundingIncrement: 5 })).toBe(100)
    expect(roundMoney(103, { roundingIncrement: 5 })).toBe(105)
    expect(roundMoney(102, { roundingIncrement: 5, roundingMode: "ceil" })).toBe(105)
    expect(roundMoney(-102, { roundingIncrement: 5, roundingMode: "ceil" })).toBe(-100)
    expect(roundMoney(112, { roundingIncrement: 25 })).toBe(100)
    expect(percentageOf(103, 100, { roundingIncrement: 5 })).toBe(105)
    expect(applyDiscount(103, 0, { roundingIncrement: 5 })).toBe(103)
  })

  test("parses extra fractions with exact rounding and cash increments", () => {
    expect(parseMoney("$1.025", "USD", { locale: "en-US", roundingMode: "halfEven" })).toBe(102)
    expect(parseMoney("$1.025", "USD", { locale: "en-US" })).toBe(103)
    expect(parseMoney("-$1.025", "USD", { locale: "en-US", roundingMode: "halfCeil" })).toBe(-102)
    expect(parseMoney("$1.03", "USD", { locale: "en-US", roundingIncrement: 5 })).toBe(105)
  })

  test("validates rounding options and discount boundaries", () => {
    for (const roundingIncrement of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => roundMoney(100, { roundingIncrement })).toThrow(RangeError)
    }
    expect(() => roundMoney(100, { roundingMode: "bankers" as "halfEven" })).toThrow(RangeError)
    expect(() => multiplyMoney(100, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(multiplyMoney(0, 1e21)).toBe(0)
    expect(applyDiscount(100, 0)).toBe(100)
    expect(applyDiscount(100, 100)).toBe(0)
    for (const percentage of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => applyDiscount(100, percentage)).toThrow(RangeError)
    }
    expect(percentageOf(100, 150)).toBe(150)
  })

  test("allocates exact totals by largest remainder with stable ties", () => {
    expect(allocateMoney(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(allocateMoney(10, [1, 2, 3])).toEqual([2, 3, 5])
    expect(allocateMoney(2, [1, 1, 1])).toEqual([1, 1, 0])
    expect(allocateMoney(-100, [1, 1, 1])).toEqual([-34, -33, -33])
    expect(allocateMoney(10, [0, 1, 0, 1])).toEqual([0, 5, 0, 5])
    expect(allocateMoney(-10, [0, 1, 0, 1])).toEqual([0, -5, 0, -5])
    expect(allocateMoney(0, [1, 2])).toEqual([0, 0])
    expect(allocateMoney(Number.MAX_SAFE_INTEGER, [1])).toEqual([Number.MAX_SAFE_INTEGER])
  })

  test("rejects invalid allocation ratios", () => {
    for (const ratios of [[], [0, 0], [-1, 1], [1.5, 1], [Number.MAX_SAFE_INTEGER + 1]]) {
      expect(() => allocateMoney(100, ratios)).toThrow(RangeError)
    }
    expect(() => allocateMoney(1.5, [1])).toThrow(RangeError)
    expect(() => allocateMoney(Number.MAX_SAFE_INTEGER + 1, [1])).toThrow(RangeError)
    expect(allocateMoney(1, [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])).toEqual([1, 0])
  })
})
