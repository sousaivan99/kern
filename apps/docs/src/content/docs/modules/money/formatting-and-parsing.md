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
import { currencyMinorUnitDigits } from "@kern/core/money"

currencyMinorUnitDigits("EUR", "en-US") // commonly 2
currencyMinorUnitDigits("JPY", "ja-JP") // commonly 0
currencyMinorUnitDigits("KWD", "en-US") // commonly 3
```

`currencyMinorUnitDigits(currency, locale?)` asks `Intl.NumberFormat` for its maximum fraction
digits. The currency should be an ISO 4217 code recognized by the runtime. Invalid codes or missing
metadata throw a native error/`RangeError`.

This metadata is useful for display and general ISO conventions. A payment provider may define a
different storage scale; provider rules take precedence at that integration boundary.

## Format integer minor units

```ts
import { formatMoney } from "@kern/core/money"

formatMoney(1_099, "EUR", { locale: "en-US" })
formatMoney(1_099, "JPY", { locale: "ja-JP" })
formatMoney(10_999, "KWD", { locale: "en-US" })
formatMoney(-1_099, "USD", {
  locale: "en-US",
  currencySign: "accounting",
})
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
import { parseMoney } from "@kern/core/money"

parseMoney("1.234,56 €", "EUR", { locale: "de-DE" }) // 123456
parseMoney("$1,234.56", "USD", { locale: "en-US" }) // 123456
parseMoney("$1.025", "USD", {
  locale: "en-US",
  roundingMode: "halfEven",
}) // 102
parseMoney("$1.03", "USD", {
  locale: "en-US",
  roundingIncrement: 5,
}) // 105
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

## Parsing options

`MoneyParseOptions` contains:

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `locale` | `Intl.LocalesArgument` | Runtime locale | Select accepted digits and currency syntax. |
| `roundingMode` | `MoneyRoundingMode` | `"halfExpand"` | Round extra fractional precision. |
| `roundingIncrement` | positive safe integer | `1` | Round the parsed minor-unit result to this increment. |

All fractional digits participate in exact rounding. Nothing is truncated before the rounding rule
runs. See [Money arithmetic](../arithmetic/#all-rounding-modes) for every mode.

Malformed input, invalid currency metadata/options, and unsafe results throw `RangeError` (or the
corresponding native `Intl` error). Parsing returns an integer; it does not return a success/failure
object. Validate/catch at the input boundary when user mistakes are expected.
