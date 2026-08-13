---
title: Quick start
description: Validate input, calculate a minor-unit price, and work with a delivery date.
sidebar:
  order: 2
---

This example combines Kern's three most substantial modules while keeping units and failure modes
visible.

```ts
import { addDays } from "@kern/core/date"
import { applyDiscount, formatMoney, multiplyMoney } from "@kern/core/money"
import { array, enumeration, number, object, string } from "@kern/core/validation"

const OrderSchema = object({
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

const order = OrderSchema.parse(input)
const subtotal = order.items.reduce(
  (total, item) => total + multiplyMoney(item.unitPriceMinor, item.quantity),
  0,
)
const total = applyDiscount(subtotal, order.discountPercent)

console.log({
  customer: order.customer.name,
  total: formatMoney(total, order.currency, { locale: "en-GB" }),
  estimatedDelivery: addDays(new Date(), 3),
})
```

Money functions accept integer minor units: `12_999` means €129.99 for EUR. Date arithmetic uses
the host's local calendar unless a helper explicitly says UTC.
