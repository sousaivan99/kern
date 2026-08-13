---
title: Money arithmetic
description: Perform checked arithmetic, exact finance rounding, percentages, discounts, and allocation.
sidebar:
  order: 2
---

```ts
import {
  addMoney,
  allocateMoney,
  applyDiscount,
  multiplyMoney,
  percentageOf,
  roundMoney,
  subtractMoney,
  sumMoney,
} from "@kern/core/money"

const subtotal = sumMoney([1_499, 2_999, -500])
const tax = percentageOf(subtotal, 17, { roundingMode: "halfEven" })
const discounted = applyDiscount(subtotal, 10)
const cashTotal = roundMoney(discounted, { roundingIncrement: 5 })
const shares = allocateMoney(cashTotal, [1, 1, 1])

console.log(addMoney(subtotal, tax), subtractMoney(discounted, tax), multiplyMoney(1_499, 3), shares)
```

All amounts are safe-integer minor units. `addMoney` and `subtractMoney` check operands and output;
`sumMoney` checks every intermediate total and returns zero for an empty input. `percentageOf`
uses percentage points (`15` means 15%) without restricting the percentage. `applyDiscount`
accepts only finite percentages from 0 through 100.

## Exact rounding

The default is `halfExpand`: nearest value, with exact ties away from zero. Every calculation uses
integer/`bigint` quotient and remainder arithmetic, including negative values and ties.

| Mode | `1 × 1.5` | `-1 × 1.5` | Exact-tie direction |
| --- | ---: | ---: | --- |
| `ceil` | 2 | -1 | toward positive infinity |
| `expand` | 2 | -2 | away from zero |
| `floor` | 1 | -2 | toward negative infinity |
| `halfCeil` | 2 | -1 | nearest, ties toward positive infinity |
| `halfEven` | 2 | -2 | nearest, ties to an even quotient |
| `halfExpand` | 2 | -2 | nearest, ties away from zero |
| `halfFloor` | 1 | -2 | nearest, ties toward negative infinity |
| `halfTrunc` | 1 | -1 | nearest, ties toward zero |
| `trunc` | 1 | -1 | toward zero |

`multiplyMoney`, `percentageOf`, `applyDiscount`, `roundMoney`, and `parseMoney` accept the same
rounding vocabulary. `roundingIncrement` is a positive safe-integer count of minor units:

```ts
import { roundMoney } from "@kern/core/money"

roundMoney(102, { roundingIncrement: 5 }) // 100
roundMoney(103, { roundingIncrement: 5 }) // 105
roundMoney(-102, { roundingIncrement: 5, roundingMode: "ceil" }) // -100
```

An increment of `5` can model rounding to the nearest five minor units. Zero, negative,
fractional, unsafe, or unknown options throw `RangeError`.

## Exact allocation

```ts
import { allocateMoney } from "@kern/core/money"

allocateMoney(100, [1, 1, 1]) // [34, 33, 33]
allocateMoney(-10, [1, 2, 3]) // [-2, -3, -5]
allocateMoney(10, [0, 1, 0, 1]) // [0, 5, 0, 5]
```

Ratios are non-negative safe-integer weights and at least one must be positive. Kern calculates
exact proportions, then distributes leftover one-minor-unit amounts by largest fractional
remainder. Equal remainders keep input order. The returned shares preserve positive, negative, and
zero totals exactly; zero-weight entries stay zero. Allocation deliberately ignores cash-rounding
increments so it never loses a minor unit.
