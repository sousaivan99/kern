import {
  addMoney,
  applyDiscount,
  formatMoney,
  multiplyMoney,
  parseMoney,
  percentageOf,
} from "@kern/core/money"

export const runMoneyExamples = (): void => {
  console.log("\nMoney (all values are minor units)")

  console.log("EUR", formatMoney(1099, "EUR", { locale: "en-US" }))
  console.log("JPY has no minor decimals", formatMoney(1099, "JPY", { locale: "ja-JP" }))
  console.log("KWD has three minor decimals", formatMoney(10_999, "KWD", { locale: "en-US" }))

  const localizedPrice = parseMoney("1.234,56 €", "EUR", { locale: "de-DE" })
  console.log("parsed localized price", localizedPrice)

  const lineTotal = multiplyMoney(1_499, 3)
  const shipping = 499
  const subtotal = addMoney(lineTotal, shipping)
  const tax = percentageOf(subtotal, 17)
  const discounted = applyDiscount(subtotal, 10)
  console.log({ lineTotal, shipping, subtotal, tax, discounted })
}

if (import.meta.main) runMoneyExamples()
