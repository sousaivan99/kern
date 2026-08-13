---
title: Money formatting and parsing
description: Format exact minor units and parse strict locale-specific currency text with explicit rounding.
sidebar:
  order: 1
---

## Formatting

```ts
import { currencyMinorUnitDigits, formatMoney } from "@kern/core/money"

console.log(currencyMinorUnitDigits("EUR", "en-US"))
console.log(formatMoney(1099, "EUR", { locale: "en-US" }))
console.log(formatMoney(1099, "JPY", { locale: "ja-JP" }))
console.log(formatMoney(10_999, "KWD", { locale: "en-US" }))
```

`currencyMinorUnitDigits` reads native `Intl.NumberFormat` currency metadata. `formatMoney` never
converts a minor-unit integer through a floating-point major-unit value, so formatting remains
exact through `Number.MAX_SAFE_INTEGER`. Currency style and currency identity are fixed by Kern;
other native formatter options remain available.

## Strict parsing

```ts
import { parseMoney } from "@kern/core/money"

const amount = parseMoney("1.234,56 €", "EUR", { locale: "de-DE" })
const accounting = parseMoney("$1.025", "USD", {
  locale: "en-US",
  roundingMode: "halfEven",
})
const cash = parseMoney("$1.03", "USD", {
  locale: "en-US",
  roundingIncrement: 5,
})

console.log(amount, accounting, cash)
```

`parseMoney` requires the selected locale's currency marker, localized digits, sign placement,
currency placement, decimal separator, and valid grouping. Grouping may be omitted, but malformed
grouping is rejected. All extra fractional digits participate in exact rounding; the default is
ties away from zero.

This is deliberately not a free-form price parser. Malformed input, invalid currency metadata,
invalid rounding options, and unsafe results throw `RangeError`.
