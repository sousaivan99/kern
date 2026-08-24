import { expect, test } from "bun:test"
import { allocateMoney, formatMoney, parseMoney, roundMoney } from "../src/money/index.js"
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

test("property: allocation conserves amounts, signs, zero weights, and safe boundaries", () => {
  checkProperty(
    "money allocation laws",
    (random, index) => {
      const count = random.integer(1, 12)
      const weights = Array.from({ length: count }, () => random.integer(0, 10_000))
      weights[random.integer(0, count - 1)] = random.integer(1, 10_000)
      return {
        amount:
          index < boundaries.length ? (boundaries[index] as number) : randomSafeInteger(random),
        weights,
      }
    },
    ({ amount, weights }) => {
      const positive = allocateMoney(amount, weights)
      const negative = allocateMoney(-amount, weights)
      expect(positive.reduce((total, value) => total + BigInt(value), 0n)).toBe(BigInt(amount))
      expect(negative.map((value) => (value === 0 ? 0 : value))).toEqual(
        positive.map((value) => (value === 0 ? 0 : -value)),
      )
      for (let index = 0; index < weights.length; index += 1) {
        if (weights[index] === 0) expect(positive[index]).toBe(0)
        expect(Number.isSafeInteger(positive[index])).toBe(true)
      }
    },
  )
})

test("property: increment rounding is idempotent, symmetric, and lands on the increment", () => {
  checkProperty(
    "money rounding laws",
    (random) => ({
      amount: random.integer(-1_000_000_000, 1_000_000_000),
      increment: random.integer(1, 1_000),
    }),
    ({ amount, increment }) => {
      const rounded = roundMoney(amount, { roundingIncrement: increment, roundingMode: "halfEven" })
      expect(Math.abs(rounded % increment)).toBe(0)
      expect(roundMoney(rounded, { roundingIncrement: increment, roundingMode: "halfEven" })).toBe(
        rounded,
      )
      expect(roundMoney(-amount, { roundingIncrement: increment, roundingMode: "halfEven" })).toBe(
        -rounded,
      )
    },
  )
})
