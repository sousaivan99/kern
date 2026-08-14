---
title: Money
description: Understand safe-integer minor units before formatting, rounding, and allocating money.
sidebar:
  order: 2
  label: Money overview
---

Kern represents money as an integer count of **minor units**. A minor unit is the smallest unit your
application has chosen to store, such as cents for many currencies.

```ts
const priceMinor = 1_099 // commonly €10.99 or $10.99
```

Do not pass a major-unit decimal such as `10.99` to a money helper. Kern rejects it because it is
not an integer.

## Start here: write the amount in the smallest unit

For a currency with two decimal places, move the decimal point two places and store the integer:

| Display amount | Minor-unit value passed to Kern |
| ---: | ---: |
| €0.01 | `1` |
| €1.00 | `100` |
| €10.99 | `1099` |
| -€2.50 | `-250` |

Then calculate with money helpers and format only for display:

```ts
import { addMoney, formatMoney } from "@kern/core/money"

const coffee = 350
const cake = 499
const total = addMoney(coffee, cake)

console.log(total) // 849 minor units
console.log(formatMoney(total, "EUR", { locale: "en-IE" })) // €8.49

// This is wrong: 4.99 is not an integer number of minor units.
addMoney(coffee, 4.99)
// RangeError: Money values must be safe integers in minor units
```

The number `849` does not contain the currency. Your application must keep `"EUR"` beside it and
must never combine amounts from different currencies.

Run the example to see both parts: Kern prints the valid total first, then stops on `4.99` with the
exact error message. Write `499` for €4.99 when the application stores cents.

## Why minor units?

JavaScript numbers use binary floating point, so many decimal fractions are not exact:

```ts
console.log(0.1 + 0.2) // 0.30000000000000004
console.log(10 + 20) // 30 exact minor units
```

Kern uses safe integers at the public boundary and exact `bigint` quotient/remainder arithmetic
inside calculations that require rounding.

## A complete purchase example

```ts
import {
  allocateMoney,
  applyDiscount,
  formatMoney,
  multiplyMoney,
  sumMoney,
} from "@kern/core/money"

const lineTotal = multiplyMoney(1_499, 3)
const subtotal = sumMoney([lineTotal, 499])
const total = applyDiscount(subtotal, 10, { roundingMode: "halfEven" })
const shares = allocateMoney(total, [2, 1])

console.log(formatMoney(total, "EUR", { locale: "en-GB" }))
console.log(shares)
```

## Shared rules

- Amounts are positive, negative, or zero safe integers.
- Kern never silently accepts `NaN`, infinities, fractions, or unsafe integers as amounts.
- Addition, subtraction, summation, multiplication, percentages, and allocation check their result.
- A result outside `Number.MIN_SAFE_INTEGER..Number.MAX_SAFE_INTEGER` throws `RangeError`.
- The default rounding mode is `halfExpand`: nearest value, with exact ties away from zero.
- Percentage arguments use percentage points: `15` means 15%.

## Currency and scale belong to your application

A plain value such as `1099` does not remember whether it is EUR, USD, JPY, a provider-specific
three-decimal amount, or a non-currency unit. Keep currency and scale beside the amount in your
domain model and never add amounts from different currencies.

`formatMoney` and `parseMoney` use native `Intl` currency fraction metadata. Payment providers and
databases may use different scale rules, especially for unusual currencies or historical data.
Convert at the integration boundary and test those mappings.

## Scope boundary

Kern provides deterministic calculation primitives. It is not:

- an FX engine or live exchange-rate provider;
- a canonical/provider-specific currency table;
- an accounting ledger or double-entry system;
- a tax engine, invoice system, or payment adapter;
- an audit trail, reconciliation service, or compliance system;
- a source of jurisdiction-specific legal rounding policy.

Your domain layer owns those rules. Kern gives it small exact operations to build on.

## Common beginner mistakes

- Do not pass `10.99`; pass integer minor units such as `1099` for a two-decimal currency.
- Do not assume every currency has two minor digits. JPY commonly uses zero and KWD commonly uses
  three according to native currency metadata.
- Do not add USD and EUR merely because both values are numbers. Kern cannot detect their currency.
- Percentage inputs use percentage points: pass `15` for 15%, not `0.15`.
- `formatMoney()` returns display text. Keep the integer amount for later calculations.
- `parseMoney()` is strict and locale-specific. A German-formatted EUR value should be parsed with
  its German locale, not whichever locale the server happens to use.
- Rounding law and payment-provider scale are business rules. Choose and test them explicitly.

## Advanced usage

### Keep currency in the domain type

Kern deliberately keeps arithmetic functions tiny, so a domain model should keep the unit metadata:

```ts
import { addMoney } from "@kern/core/money"

interface Money {
  readonly currency: "EUR" | "USD"
  readonly minorUnits: number
}

function addSameCurrency(left: Money, right: Money): Money {
  if (left.currency !== right.currency) {
    throw new RangeError("Cannot add different currencies")
  }
  return {
    currency: left.currency,
    minorUnits: addMoney(left.minorUnits, right.minorUnits),
  }
}
```

### Make rounding a named policy

Do not scatter unexplained modes across business code. Define one reviewed option object for each
domain operation, such as tax calculation or cash settlement. The [arithmetic guide](./arithmetic/)
documents nine exact modes, arbitrary positive minor-unit increments, and largest-remainder
allocation.

### Treat `Intl` metadata as display metadata

`currencyMinorUnitDigits()` reports the executing runtime's currency formatting convention.
Payment processors, ledgers, historical currencies, tokens, and contractual units may define a
different storage scale. Validate that mapping at each integration boundary rather than treating
`Intl` as a provider currency table.

- [Formatting and parsing](./formatting-and-parsing/) covers locales, currency display, and strict
  input parsing.
- [Arithmetic](./arithmetic/) covers every operation, rounding mode, cash increment, and exact
  allocation.
