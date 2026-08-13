---
title: Money
description: Safe-integer minor-unit primitives with exact finance rounding, formatting, parsing, and allocation.
sidebar:
  order: 2
  label: Money overview
---

Every Kern money value is an integer count of currency **minor units**. For EUR and USD, `1099`
commonly means 10.99. For JPY it commonly means 1099 because native currency metadata uses zero
fraction digits.

```ts
import { allocateMoney, applyDiscount, formatMoney, multiplyMoney, sumMoney } from "@kern/core/money"

const lineTotal = multiplyMoney(1_499, 3)
const subtotal = sumMoney([lineTotal, 499])
const total = applyDiscount(subtotal, 10, { roundingMode: "halfEven" })
const shares = allocateMoney(total, [2, 1])

console.log(formatMoney(total, "EUR", { locale: "en-GB" }), shares)
```

Money operations validate inputs, intermediate values, and results as safe integers. The helpers
cover deterministic calculation primitives used in financial software, but plain amounts do not
carry a currency or scale. Applications must not mix currencies and must supply provider-specific
minor-unit conventions where they differ from native `Intl` metadata.

Kern is not an FX engine, live currency table, accounting ledger, tax engine, payment-provider
adapter, or compliance system. It does not provide audit trails, posting rules, reconciliation,
jurisdictional rounding policy, or legal advice. Those responsibilities belong in the consuming
domain layer.

- [Formatting and parsing](./formatting-and-parsing/) explains exact localized I/O.
- [Arithmetic](./arithmetic/) documents all rounding modes, cash increments, and allocation.
