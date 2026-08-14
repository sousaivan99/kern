---
title: Money formatting and parsing
description: Format exact minor units and strictly parse localized currency text.
sidebar:
  order: 1
---

Formatting is for display. Parsing is for accepting a known locale's currency format. Neither
function converts currencies.

## Find the native currency precision

```ts
import { currencyMinorUnitDigits } from "@sousaivan/kern/money"

console.log("EUR:", currencyMinorUnitDigits("EUR", "en-US")) // commonly 2
console.log("JPY:", currencyMinorUnitDigits("JPY", "ja-JP")) // commonly 0
console.log("KWD:", currencyMinorUnitDigits("KWD", "en-US")) // commonly 3

currencyMinorUnitDigits("NOPE", "en-US")
// RangeError: currency is not a well-formed currency code
```

`currencyMinorUnitDigits(currency, locale?)` asks `Intl.NumberFormat` for its maximum fraction
digits. The currency should be an ISO 4217 code recognized by the runtime. Invalid codes or missing
metadata throw a native error/`RangeError`.

This metadata is useful for display and general ISO conventions. A payment provider may define a
different storage scale; provider rules take precedence at that integration boundary.

## Format integer minor units

```ts
import { formatMoney } from "@sousaivan/kern/money"

console.log(formatMoney(1_099, "EUR", { locale: "en-US" }))
console.log(formatMoney(1_099, "JPY", { locale: "ja-JP" }))
console.log(formatMoney(10_999, "KWD", { locale: "en-US" }))
console.log(formatMoney(-1_099, "USD", {
  locale: "en-US",
  currencySign: "accounting",
}))

formatMoney(10.99, "EUR", { locale: "en-US" })
// RangeError: Money values must be safe integers in minor units
```

`formatMoney(minorUnits, currency, options?)` formats through `Intl.NumberFormat` without first
converting the integer to an imprecise floating-point major-unit number. Values remain exact through
the safe-integer range.

`MoneyFormatOptions` accepts `locale` plus native `Intl.NumberFormatOptions`, except `style` and
`currency`, which Kern fixes to the supplied currency:

| Category | Common options |
| --- | --- |
| Locale | `locale`, `localeMatcher`, `numberingSystem` |
| Currency display | `currencyDisplay`, `currencySign` |
| Digits | `minimumIntegerDigits`, `minimumFractionDigits`, `maximumFractionDigits`, `minimumSignificantDigits`, `maximumSignificantDigits` |
| Group/sign | `useGrouping`, `signDisplay` |
| Notation | `notation`, `compactDisplay` |
| Rounding/display | `roundingMode`, `roundingPriority`, `roundingIncrement`, `trailingZeroDisplay` when supported by the runtime |

These are native **display options**, not Kern money-arithmetic options. For example, formatter
rounding changes displayed text; it does not return a new integer amount. Use `roundMoney` when the
stored/settled amount itself must change.

Invalid safe-integer amounts throw `RangeError`. Invalid native locale, currency, or option
combinations follow `Intl.NumberFormat` errors. When `locale` is omitted, the runtime default is
used.

## Parse strict localized currency text

```ts
import { parseMoney } from "@sousaivan/kern/money"

console.log(parseMoney("1.234,56 €", "EUR", { locale: "de-DE" })) // 123456
console.log(parseMoney("$1,234.56", "USD", { locale: "en-US" })) // 123456
console.log(parseMoney("$1.025", "USD", {
  locale: "en-US",
  roundingMode: "halfEven",
})) // 102
console.log(parseMoney("$1.03", "USD", {
  locale: "en-US",
  roundingIncrement: 5,
})) // 105

parseMoney("$12,34.56", "USD", { locale: "en-US" })
// RangeError: Invalid monetary value
```

`parseMoney(input, currency, options?)` requires the text to follow the selected locale and
currency. It checks:

- the correct currency marker;
- the locale's standard positive/negative sign placement;
- currency placement before or after the number;
- localized digits;
- the locale decimal separator;
- grouping separators and primary/secondary group sizes;
- surrounding whitespace after trimming.

Grouping can be omitted. If present, it must be valid: an `en-US` parser rejects `"$12,34.56"`.
The parser is intentionally not a free-form number extractor and will reject plain `"1234.56"`
when the selected currency format requires `$` or another marker.

## Advanced: parsing options

`MoneyParseOptions` contains:

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `locale` | `Intl.LocalesArgument` | Runtime locale | Select accepted digits and currency syntax. |
| `roundingMode` | `MoneyRoundingMode` | `"halfExpand"` | Round extra fractional precision. |
| `roundingIncrement` | positive safe integer | `1` | Round the parsed minor-unit result to this increment. |

All fractional digits participate in exact rounding. Nothing is truncated before the rounding rule
runs. See [Money arithmetic](../arithmetic/#advanced-all-rounding-modes) for every mode.

Malformed input, invalid currency metadata/options, and unsafe results throw `RangeError` (or the
corresponding native `Intl` error). Parsing returns an integer; it does not return a success/failure
object. Validate/catch at the input boundary when user mistakes are expected.

The examples intentionally end with one invalid input. Select **Run** to keep the successful output
visible beside the exact error message. This makes the difference between localized display text,
integer minor units, and rejected text concrete before you connect a real form.
