---
title: React
description: Learn each Kern module through a small, independent React component.
---

Install Kern in an existing React application:

```bash
npm install @sousaivan/kern
```

Kern does not need a provider, hook, or React adapter. Each section below is a separate example, so
you can study and copy one module at a time. The examples use direct subpath imports to keep module
ownership and tree-shaking clear.

## Validation: show form feedback

Use [`validation`](../../modules/validation/) with `safeParse()` when invalid form input is expected.
This component validates one controlled field and renders either the cleaned email or the first
issue message.

<!-- framework-test: react/src/App.tsx -->
```tsx
import { useState } from "react"
import { object, string } from "@sousaivan/kern/validation"

const Contact = object({
  email: string().trim().email(),
})

export function App() {
  const [email, setEmail] = useState("ada@example.com")
  const result = Contact.safeParse({ email })
  const message = result.success
    ? `Ready: ${result.data.email}`
    : (result.issues[0]?.message ?? "Invalid email")

  return (
    <main>
      <h1>Contact form</h1>
      <label>
        Email
        <input
          name="email"
          onChange={(event) => setEmail(event.currentTarget.value)}
          type="email"
          value={email}
        />
      </label>
      <p aria-live="polite">{message}</p>
    </main>
  )
}
```

Declare the immutable schema outside the component so it is not recreated on every render. You do
not need a second state variable for issues because they are derived from the current email.

## Money: render an order total

Use [`money`](../../modules/money/) for prices stored as integer minor units. This example adds
three prices and formats the result only when it reaches the UI.

<!-- framework-test: react/src/examples/MoneyExample.tsx -->
```tsx
import { formatMoney, sumMoney } from "@sousaivan/kern/money"

const pricesMinor = [1099, 250, 450]

export function MoneyExample() {
  const totalMinor = sumMoney(pricesMinor)
  const total = formatMoney(totalMinor, "EUR", { locale: "en-GB" })

  return <p>Order total: {total}</p>
}
```

The state or domain model should keep `1799`, not the formatted `"€17.99"`. The string is for
display and should not be used in later calculations.

## Date: display a delivery date

Use [`date`](../../modules/date/) for small native `Date` operations. This component adds two days
without mutating the original order date.

<!-- framework-test: react/src/examples/DateExample.tsx -->
```tsx
import { addDays, formatDate } from "@sousaivan/kern/date"

const orderedAt = new Date("2026-08-16T12:00:00Z")

export function DateExample() {
  const deliveryAt = addDays(orderedAt, 2)
  const delivery = formatDate(deliveryAt, {
    day: "numeric",
    locale: "en-GB",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  })

  return <p>Delivery: {delivery}</p>
}
```

Explicit locale and timezone options prevent server-rendered React and the browser from choosing
different display text.

## Number: render progress

Use [`number`](../../modules/number/) for non-financial calculations. Calculate with numbers first,
then create the localized display string.

<!-- framework-test: react/src/examples/NumberExample.tsx -->
```tsx
import { formatPercentage, percentageOfTotal } from "@sousaivan/kern/number"

export function NumberExample() {
  const completed = 3
  const total = 4
  const percentage = percentageOfTotal(completed, total)
  const label = formatPercentage(percentage, { locale: "en-GB" })

  return <p>Progress: {label}</p>
}
```

`percentageOfTotal(3, 4)` returns `75` percentage points. Use the money module when financial
rounding or currency units are involved.

## String: build a product link

Use [`string`](../../modules/string/) for focused text transformations. Keep the original name for
display and derive a readable route slug separately.

<!-- framework-test: react/src/examples/StringExample.tsx -->
```tsx
import { slugify } from "@sousaivan/kern/string"

const product = { id: "course-1", name: "Crème Brûlée Course" }

export function StringExample() {
  const slug = slugify(product.name)

  return <a href={`/products/${product.id}-${slug}`}>{product.name}</a>
}
```

The stable ID prevents two products with the same name from producing the same route.

## Array: render unique records

Use [`array`](../../modules/array/) before JSX when the collection needs a semantic operation.
`uniqueBy()` keeps the first product for each ID and leaves the source array unchanged.

<!-- framework-test: react/src/examples/ArrayExample.tsx -->
```tsx
import { uniqueBy } from "@sousaivan/kern/array"

const inventory = [
  { id: "coffee", name: "Coffee" },
  { id: "tea", name: "Tea" },
  { id: "coffee", name: "Duplicate coffee" },
]

export function ArrayExample() {
  const products = uniqueBy(inventory, (product) => product.id)

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
```

Use the stable product ID as the React key. For large dynamic arrays, measure before adding
memoization; small transformations are usually fine during rendering.

## Object: create a public view model

Use [`object`](../../modules/object/) to copy deliberate fields from a known plain object. This
keeps an internal note out of the component's view model.

<!-- framework-test: react/src/examples/ObjectExample.tsx -->
```tsx
import { pick } from "@sousaivan/kern/object"

const account = {
  id: "user-1",
  name: "Ada",
  internalNote: "Do not expose this",
}

export function ObjectExample() {
  const publicAccount = pick(account, ["id", "name"] as const)

  return <p>{publicAccount.name}</p>
}
```

`pick()` selects fields but does not validate them. Validate unknown API data first, then create the
smaller view model.

## Async: debounce a search value

Use [`async`](../../modules/async/) for scheduling and Promise control flow. A debounced function
should be created once and cancelled when the component unmounts.

<!-- framework-test: react/src/examples/AsyncExample.tsx -->
```tsx
import { useEffect, useMemo, useState } from "react"
import { debounce } from "@sousaivan/kern/async"

export function AsyncExample() {
  const [query, setQuery] = useState("")
  const [settledQuery, setSettledQuery] = useState("")
  const updateLater = useMemo(() => debounce(setSettledQuery, 250), [])

  useEffect(() => () => updateLater.cancel(), [updateLater])

  return (
    <label>
      Search
      <input
        onChange={(event) => {
          const value = event.currentTarget.value
          setQuery(value)
          updateLater(value)
        }}
        value={query}
      />
      <span>Searching for: {settledQuery || "nothing yet"}</span>
    </label>
  )
}
```

The input state updates immediately. Only `settledQuery` waits until typing pauses, and the cleanup
prevents a pending callback from updating an unmounted component.

## Check the production setup

In a Vite React project, run TypeScript and the production compiler:

```bash
npx tsc --noEmit
npm run build
```

Kern's framework suite type-checks every mini-example against the packed package. It also builds
client and SSR bundles and exercises the validation example in Chromium.
