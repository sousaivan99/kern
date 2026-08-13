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

- [Formatting and parsing](./formatting-and-parsing/) covers locales, currency display, and strict
  input parsing.
- [Arithmetic](./arithmetic/) covers every operation, rounding mode, cash increment, and exact
  allocation.
