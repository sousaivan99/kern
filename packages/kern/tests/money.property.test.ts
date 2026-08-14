import { expect, test } from "bun:test"
import { formatMoney, parseMoney } from "../src/money/index.js"
import { checkProperty, randomSafeInteger } from "./support/property.js"

const configurations = [
  { currency: "USD", locale: "en-US" },
  { currency: "EUR", locale: "de-DE" },
  { currency: "INR", locale: "hi-IN" },
  { currency: "EGP", locale: "ar-EG" },
  { currency: "JPY", locale: "ja-JP" },
  { currency: "KWD", locale: "en-US" },
] as const

const boundaries = [Number.MIN_SAFE_INTEGER, -1, 0, 1, Number.MAX_SAFE_INTEGER] as const

test("property: localized money formatting and parsing round-trip exact minor units", () => {
  checkProperty(
    "localized money round-trip",
    (random, index) => {
      const configuration = configurations[index % configurations.length] ?? configurations[0]
      return {
        ...configuration,
        minorUnits:
          index < boundaries.length ? (boundaries[index] as number) : randomSafeInteger(random),
      }
    },
    ({ currency, locale, minorUnits }) => {
      const formatted = formatMoney(minorUnits, currency, { locale })
      expect(parseMoney(formatted, currency, { locale })).toBe(minorUnits)
    },
  )
})
