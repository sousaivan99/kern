---
title: Quick start
description: Build a small validated order flow one understandable step at a time.
sidebar:
  order: 2
---

This walkthrough validates unknown input, calculates an exact minor-unit price, formats it for a
person, and creates an estimated delivery date.

## 1. Describe valid input

```ts
import { array, enumeration, number, object, string } from "@kern/core/validation"

const Order = object({
  customer: object({
    name: string().trim().min(2),
    email: string().trim().email(),
  }),
  items: array(
    object({
      name: string().trim().min(1),
      unitPriceMinor: number().integer().positive(),
      quantity: number().integer().positive(),
    }),
  ),
  currency: enumeration(["EUR", "USD", "GBP"] as const),
  discountPercent: number().min(0).max(100).default(0),
})
```

Read the schema from the outside inward:

- `object({...})` describes an object and its fields.
- `array(schema)` applies one schema to every array item.
- `string()` and `number()` check types without coercing them.
- Fluent methods such as `.trim()`, `.integer()`, and `.positive()` add behavior.
- `.default(0)` allows the field to be missing and produces `0` in parsed output.
- `as const` lets TypeScript preserve the exact currency strings.

The `Order` value is both the runtime validator and the source of its TypeScript types. You do not
need to write a matching interface by hand.

## 2. Safely validate unknown data

Network requests, JSON files, form submissions, and environment variables should start as
`unknown` until they have been checked.

```ts
import { object, string } from "@kern/core/validation"

const Order = object({
  customer: object({ name: string(), email: string().email() }),
})

const input: unknown = {
  customer: { name: "Ada Lovelace", email: "ada@example.com" },
}

const result = Order.safeParse(input)

if (!result.success) {
  console.error(result.issues)
  throw new Error("The order is invalid")
}

const order = result.data
```

After the success check, TypeScript knows the complete output type. The customer's name is already
trimmed and the discount always exists.

Use `safeParse()` when invalid input is expected and you want to show or return the issues. Use
`parse()` when invalid input is exceptional and should throw a `ValidationError`.

## 3. Calculate money in minor units

```ts
import { applyDiscount, multiplyMoney, sumMoney } from "@kern/core/money"

const order = {
  items: [{ unitPriceMinor: 12_999, quantity: 1 }],
  discountPercent: 10,
}

const lineTotals = order.items.map((item) =>
  multiplyMoney(item.unitPriceMinor, item.quantity),
)
const subtotal = sumMoney(lineTotals)
const total = applyDiscount(subtotal, order.discountPercent)
```

Money values are integer minor units. For EUR, `12_999` means €129.99. Keeping integer units avoids
the usual floating-point problem where values such as `0.1 + 0.2` are not exact.

Kern validates every money input and result as a safe integer. Operations that can produce a
fraction use exact rounding; the default is nearest with ties away from zero.

## 4. Format output and calculate a date

```ts
import { addDays, formatDate } from "@kern/core/date"
import { formatMoney } from "@kern/core/money"

const order = { customer: { name: "Ada" }, currency: "EUR" }
const total = 11_699
const estimatedDelivery = addDays(new Date(), 3)

console.log({
  customer: order.customer.name,
  total: formatMoney(total, order.currency, { locale: "en-GB" }),
  estimatedDelivery: formatDate(estimatedDelivery, { locale: "en-GB" }),
})
```

`formatMoney()` and `formatDate()` use native `Intl` formatting. Pass `locale` when output must be
predictable for a particular audience. Date arithmetic uses the host's local calendar unless a
helper explicitly says UTC.

## Complete example

```ts
import { addDays, formatDate } from "@kern/core/date"
import { applyDiscount, formatMoney, multiplyMoney, sumMoney } from "@kern/core/money"
import { array, enumeration, number, object, string } from "@kern/core/validation"

const Order = object({
  customer: object({
    name: string().trim().min(2),
    email: string().trim().email(),
  }),
  items: array(
    object({
      name: string().trim().min(1),
      unitPriceMinor: number().integer().positive(),
      quantity: number().integer().positive(),
    }),
  ),
  currency: enumeration(["EUR", "USD", "GBP"] as const),
  discountPercent: number().min(0).max(100).default(0),
})

const input: unknown = {
  customer: { name: " Ada Lovelace ", email: "ada@example.com" },
  items: [{ name: "Keyboard", unitPriceMinor: 12_999, quantity: 1 }],
  currency: "EUR",
  discountPercent: 10,
}

const order = Order.parse(input)
const subtotal = sumMoney(
  order.items.map((item) => multiplyMoney(item.unitPriceMinor, item.quantity)),
)
const total = applyDiscount(subtotal, order.discountPercent)
const estimatedDelivery = addDays(new Date(), 3)

console.log({
  customer: order.customer.name,
  total: formatMoney(total, order.currency, { locale: "en-GB" }),
  estimatedDelivery: formatDate(estimatedDelivery, { locale: "en-GB" }),
})
```

Next, read [Core ideas](./core-ideas/) for the rules shared by every module, or go directly to the
[Validation overview](../../modules/validation/), [Money overview](../../modules/money/), or
[Date overview](../../modules/date/).
