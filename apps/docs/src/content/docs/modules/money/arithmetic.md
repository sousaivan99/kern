---
title: Money arithmetic
description: Add, scale, discount, round, and allocate integer minor units exactly.
sidebar:
  order: 2
---

Every amount on this page is a safe-integer count of minor units.

## `addMoney(leftMinorUnits, rightMinorUnits)`

```ts
import { addMoney } from "@kern/core/money"

console.log("Success:", addMoney(1_099, 250)) // 1349

addMoney(1_099, 2.5)
// RangeError: Money values must be safe integers in minor units
```

`addMoney()` adds two integer minor-unit amounts. Both operands and the result must be safe
integers. The helper does not know the currency, so your application must ensure both values use
the same currency and scale.

## `subtractMoney(leftMinorUnits, rightMinorUnits)`

```ts
import { subtractMoney } from "@kern/core/money"

console.log("Success:", subtractMoney(1_099, 100)) // 999
console.log("Negative result:", subtractMoney(500, 750)) // -250

subtractMoney(1_099, Number.NaN)
// RangeError: Money values must be safe integers in minor units
```

`subtractMoney()` calculates `leftMinorUnits - rightMinorUnits`. Negative results are valid. It
validates both operands and the result.

## `sumMoney(values)`

```ts
import { sumMoney } from "@kern/core/money"

console.log("Success:", sumMoney([1_099, 250, -100])) // 1249
console.log("Empty list:", sumMoney([])) // 0

sumMoney([1_099, 2.5])
// RangeError: Money values must be safe integers in minor units
```

`sumMoney()` totals an array of minor-unit values. It uses checked addition for every item, so an
unsafe intermediate total throws even if later values would bring the final total back into range.

## Multiply an amount

```ts
import { multiplyMoney } from "@kern/core/money"

console.log("Whole multiplier:", multiplyMoney(1_499, 3)) // 4497
console.log("Decimal multiplier:", multiplyMoney(100, 1.5)) // 150
console.log("Rounded result:", multiplyMoney(1, 0.5)) // 1

multiplyMoney(100, Number.NaN)
// RangeError: Money factors must be finite
```

`multiplyMoney(minorUnits, multiplier, options?)` converts the finite JavaScript multiplier to an
exact decimal ratio based on its source representation, then rounds to the requested minor-unit
increment. Negative and zero multipliers are allowed. `NaN` and infinities throw `RangeError`.

## `percentageOf(minorUnits, percentage, options?)`

```ts
import { percentageOf } from "@kern/core/money"

console.log("Success:", percentageOf(10_000, 17.5)) // 1750
console.log("Negative percentage:", percentageOf(10_000, -10)) // -1000

percentageOf(10_000, Number.POSITIVE_INFINITY)
// RangeError: Money factors must be finite
```

`percentageOf(minorUnits, percentage, options?)` is intentionally unrestricted: negative or above
100 percentages may be useful for deltas, taxes, and ratios. The percentage must still be finite.

## `applyDiscount(minorUnits, percentage, options?)`

```ts
import { applyDiscount } from "@kern/core/money"

console.log("15% off:", applyDiscount(1_099, 15)) // 934
console.log("100% off:", applyDiscount(1_099, 100)) // 0
console.log("No discount:", applyDiscount(1_099, 0)) // 1099

applyDiscount(1_099, 120)
// RangeError: Discount percentage must be between 0 and 100
```

`applyDiscount(minorUnits, percentage, options?)` accepts only finite values from `0` through `100`
inclusive. It calculates the rounded discount with `percentageOf`, then subtracts it from the
original amount. Invalid percentages throw `RangeError`.

## Advanced: rounding options

The following functions accept `MoneyRoundingOptions`:

- `multiplyMoney`
- `percentageOf`
- `applyDiscount`
- `roundMoney`
- `parseMoney`

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `roundingMode` | `MoneyRoundingMode` | `"halfExpand"` | Select how a fractional result moves. |
| `roundingIncrement` | positive safe integer | `1` | Round to a multiple of this many minor units. |

Unknown mode strings and zero, negative, fractional, infinite, `NaN`, or unsafe increments throw
`RangeError`.

## Advanced: all rounding modes

The non-`half` modes always choose one direction when a result is not exact. The `half` modes round
to the nearest value and differ only at an exact tie.

| Mode | Positive `1.5` | Negative `-1.5` | Rule |
| --- | ---: | ---: | --- |
| `ceil` | 2 | -1 | Toward positive infinity. |
| `expand` | 2 | -2 | Away from zero. |
| `floor` | 1 | -2 | Toward negative infinity. |
| `trunc` | 1 | -1 | Toward zero. |
| `halfCeil` | 2 | -1 | Nearest; ties toward positive infinity. |
| `halfEven` | 2 | -2 | Nearest; ties to the even quotient. |
| `halfExpand` | 2 | -2 | Nearest; ties away from zero. |
| `halfFloor` | 1 | -2 | Nearest; ties toward negative infinity. |
| `halfTrunc` | 1 | -1 | Nearest; ties toward zero. |

For half modes, values below half move to the nearer lower-magnitude result and values above half
move to the nearer higher-magnitude result. Only exact ties use the named tie rule.

```ts
import { multiplyMoney } from "@kern/core/money"

console.log(multiplyMoney(1, 1.4, { roundingMode: "halfEven" })) // 1
console.log(multiplyMoney(1, 1.5, { roundingMode: "halfEven" })) // 2
console.log(multiplyMoney(1, 2.5, { roundingMode: "halfEven" })) // 2
console.log(multiplyMoney(1, 1.6, { roundingMode: "halfEven" })) // 2
```

`halfEven` is often called bankers' rounding. Whether it is appropriate is a business decision;
Kern does not select a jurisdictional policy for you.

## Round to a cash increment

```ts
import { roundMoney } from "@kern/core/money"

console.log(roundMoney(102, { roundingIncrement: 5 })) // 100
console.log(roundMoney(103, { roundingIncrement: 5 })) // 105
console.log(roundMoney(-102, { roundingIncrement: 5, roundingMode: "ceil" })) // -100

roundMoney(102, { roundingIncrement: 0 })
// RangeError: roundingIncrement must be a positive safe integer
```

`roundMoney(minorUnits, options?)` rounds an already-integer amount to an increment. An increment of
`5` means the nearest multiple of five minor units, commonly used for cash settlement where the
smallest coin is five cents. An increment of `100` rounds to whole major units only when the
currency has two minor digits.

The increment is a unit count, not a decimal scale or list of ECMA-402-permitted increments. Any
positive safe integer is accepted.

## Allocate an amount exactly

```ts
import { allocateMoney } from "@kern/core/money"

console.log("Equal shares:", allocateMoney(100, [1, 1, 1])) // [34, 33, 33]
console.log("Weighted:", allocateMoney(10, [1, 2, 3])) // [2, 3, 5]
console.log("Negative:", allocateMoney(-10, [1, 2, 3])) // [-2, -3, -5]
console.log("Zero weights:", allocateMoney(10, [0, 1, 0, 1])) // [0, 5, 0, 5]
console.log("Zero total:", allocateMoney(0, [1, 1])) // [0, 0]

allocateMoney(100, [])
// RangeError: Money allocation ratios cannot be empty
```

`allocateMoney(minorUnits, ratios)` treats ratios as relative weights. `[1, 1]`, `[50, 50]`, and
`[2, 2]` all represent equal shares.

Rules:

1. `ratios` must not be empty.
2. Every ratio must be a non-negative safe integer.
3. At least one ratio must be positive.
4. Zero-weight positions always receive zero.
5. Kern calculates exact proportions with `bigint`.
6. Remaining one-minor-unit amounts go to the largest fractional remainders.
7. Equal remainders use stable input order, so earlier recipients win ties.
8. Positive, negative, and zero totals are preserved exactly.

Allocation always uses one-minor-unit resolution and ignores cash-rounding increments. Apply cash
rounding to the final settlement amount only when your domain rules require it.

## Error summary

All money arithmetic throws `RangeError` for invalid numeric configuration, non-safe-integer
amounts, non-finite factors/percentages, unsafe results, or invalid allocation ratios. Callback
errors are not involved; these helpers are deterministic synchronous functions.

Each runnable example above prints valid results before deliberately passing one invalid value.
The console keeps the successful lines visible and then shows the exact thrown error. In real code,
validate user input before calculation or catch the error at the application boundary.
