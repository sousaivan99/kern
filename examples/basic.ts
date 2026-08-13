import { addDays } from "@kern/core/date"
import { addMoney, applyDiscount, formatMoney, multiplyMoney } from "@kern/core/money"
import { array, enumeration, type Infer, number, object, string } from "@kern/core/validation"

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

type Order = Infer<typeof OrderSchema>

const input: unknown = {
  customer: { name: " Ada Lovelace ", email: "ada@example.com" },
  items: [
    { name: "Mechanical keyboard", unitPriceMinor: 12_999, quantity: 1 },
    { name: "USB-C cable", unitPriceMinor: 1_499, quantity: 2 },
  ],
  currency: "EUR",
  discountPercent: 10,
}

const order: Order = OrderSchema.parse(input)
const subtotal = order.items.reduce(
  (total, item) => addMoney(total, multiplyMoney(item.unitPriceMinor, item.quantity)),
  0,
)
const total = applyDiscount(subtotal, order.discountPercent)

console.log({
  customer: order.customer.name,
  subtotal: formatMoney(subtotal, order.currency, { locale: "en-GB" }),
  discount: `${order.discountPercent}%`,
  total: formatMoney(total, order.currency, { locale: "en-GB" }),
  estimatedDelivery: addDays(new Date("2026-08-13T10:00:00Z"), 3).toISOString(),
})
