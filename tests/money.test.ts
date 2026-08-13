import { describe, expect, test } from "bun:test"
import {
  addMoney,
  applyDiscount,
  currencyMinorUnitDigits,
  formatMoney,
  multiplyMoney,
  parseMoney,
  percentageOf,
  subtractMoney,
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

  test("uses checked integer arithmetic", () => {
    expect(addMoney(100, 25)).toBe(125)
    expect(subtractMoney(100, 25)).toBe(75)
    expect(multiplyMoney(101, 1.5)).toBe(152)
    expect(multiplyMoney(-101, 1.5)).toBe(-152)
    expect(percentageOf(999, 15)).toBe(150)
    expect(applyDiscount(999, 15)).toBe(849)
    expect(() => addMoney(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError)
  })
})
