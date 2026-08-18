---
title: Nuxt
description: Learn each Kern module through a small Nuxt component or server-route example.
---

Install Kern in the Nuxt application:

```bash
npm install @sousaivan/kern
```

Kern needs no Nuxt module and no `nuxt.config.ts` entry. Each section below is independent. Start
with one small component or server boundary instead of combining every module in one page.

## Validation: check the browser and server

Use [`validation`](../../modules/validation/) for client feedback, but validate again on the server.
A caller can skip or alter browser code.

<!-- framework-test: nuxt/app/app.vue -->
```vue
<script setup lang="ts">
import { computed, ref } from "vue"
import { object, string } from "@sousaivan/kern/validation"

const Contact = object({
  email: string().trim().email(),
})

const email = ref("ada@example.com")
const result = computed(() => Contact.safeParse({ email: email.value }))
const message = computed(() =>
  result.value.success
    ? `Ready: ${result.value.data.email}`
    : (result.value.issues[0]?.message ?? "Invalid email"),
)
</script>

<template>
  <main>
    <h1>Nuxt contact form</h1>
    <label>
      Email
      <input v-model="email" name="email" type="email" />
    </label>
    <p aria-live="polite">{{ message }}</p>
  </main>
</template>
```

The matching server route treats the request body as `unknown` and returns structured issues for
an ordinary validation failure:

<!-- framework-test: nuxt/server/api/contact.post.ts -->
```ts framework-only
import { object, string } from "@sousaivan/kern/validation"

const Contact = object({
  name: string().trim().min(2),
  email: string().trim().email(),
})

export default defineEventHandler(async (event) => {
  const result = Contact.safeParse(await readBody(event))

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid contact",
      data: { issues: result.issues },
    })
  }

  return result.data
})
```

The object schema strips unknown keys by default, and the successful result is inferred as
`{ name: string; email: string }`.

## Money: render an SSR-safe total

Use [`money`](../../modules/money/) for integer minor-unit prices. Pass an explicit locale so SSR
and hydration produce the same currency text.

<!-- framework-test: nuxt/app/components/examples/MoneyExample.vue -->
```vue
<script setup lang="ts">
import { formatMoney, sumMoney } from "@sousaivan/kern/money"

const pricesMinor = [1099, 250, 450]
const totalMinor = sumMoney(pricesMinor)
const total = formatMoney(totalMinor, "EUR", { locale: "en-GB" })
</script>

<template>
  <p>Order total: {{ total }}</p>
</template>
```

Keep `1799` in application data, not `"€17.99"`. The formatted string is display text only.

## Date: control SSR timezone output

Use [`date`](../../modules/date/) for small native `Date` operations. Choose the display timezone
instead of inheriting the Nuxt server's host timezone.

<!-- framework-test: nuxt/app/components/examples/DateExample.vue -->
```vue
<script setup lang="ts">
import { addDays, formatDate } from "@sousaivan/kern/date"

const orderedAt = new Date("2026-08-16T12:00:00Z")
const deliveryAt = addDays(orderedAt, 2)
const delivery = formatDate(deliveryAt, {
  day: "numeric",
  locale: "en-GB",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})
</script>

<template>
  <p>Delivery: {{ delivery }}</p>
</template>
```

`addDays()` returns a new date and leaves the supplied order date unchanged.

## Number: display completion progress

Use [`number`](../../modules/number/) for ordinary quantities and percentages. Calculate first,
then localize the value for display.

<!-- framework-test: nuxt/app/components/examples/NumberExample.vue -->
```vue
<script setup lang="ts">
import { formatPercentage, percentageOfTotal } from "@sousaivan/kern/number"

const completed = 3
const total = 4
const percentage = percentageOfTotal(completed, total)
const label = formatPercentage(percentage, { locale: "en-GB" })
</script>

<template>
  <p>Progress: {{ label }}</p>
</template>
```

Use the money module instead when currency units or financial rounding are involved.

## String: create a Nuxt route

Use [`string`](../../modules/string/) to derive a readable route segment while preserving the
original product name for display.

<!-- framework-test: nuxt/app/components/examples/StringExample.vue -->
```vue
<script setup lang="ts">
import { slugify } from "@sousaivan/kern/string"

const product = { id: "course-1", name: "Crème Brûlée Course" }
const slug = slugify(product.name)
</script>

<template>
  <NuxtLink :to="`/products/${product.id}-${slug}`">
    {{ product.name }}
  </NuxtLink>
</template>
```

The stable ID makes the route unique even when two products share the same name.

## Array: prepare data for `v-for`

Use [`array`](../../modules/array/) before rendering when a list needs a semantic collection
operation. `uniqueBy()` keeps the first record for each ID.

<!-- framework-test: nuxt/app/components/examples/ArrayExample.vue -->
```vue
<script setup lang="ts">
import { uniqueBy } from "@sousaivan/kern/array"

const inventory = [
  { id: "coffee", name: "Coffee" },
  { id: "tea", name: "Tea" },
  { id: "coffee", name: "Duplicate coffee" },
]
const products = uniqueBy(inventory, (product) => product.id)
</script>

<template>
  <ul>
    <li v-for="product in products" :key="product.id">
      {{ product.name }}
    </li>
  </ul>
</template>
```

The original array is not mutated. If the source is reactive, put the transformation in a
`computed()` value.

## Object: create a page view model

Use [`object`](../../modules/object/) to select deliberate fields from a known plain object. This
keeps internal data out of the value passed to a page or component.

<!-- framework-test: nuxt/app/components/examples/ObjectExample.vue -->
```vue
<script setup lang="ts">
import { pick } from "@sousaivan/kern/object"

const account = {
  id: "user-1",
  name: "Ada",
  internalNote: "Do not expose this",
}
const publicAccount = pick(account, ["id", "name"] as const)
</script>

<template>
  <p>{{ publicAccount.name }}</p>
</template>
```

Validate unknown API data before selecting fields. `pick()` does not check the property values.

## Async: retry recoverable work

Use [`async`](../../modules/async/) for Promise control flow and scheduling. This button retries one
simulated temporary failure and then updates a ref.

<!-- framework-test: nuxt/app/components/examples/AsyncExample.vue -->
```vue
<script setup lang="ts">
import { ref } from "vue"
import { retry } from "@sousaivan/kern/async"

const status = ref("Not loaded")

const load = async (): Promise<void> => {
  status.value = await retry(
    (attempt) => {
      if (attempt === 1) throw new Error("Temporary failure")
      return "Loaded"
    },
    { attempts: 3, delay: 100 },
  )
}
</script>

<template>
  <button type="button" @click="load">Load</button>
  <p>{{ status }}</p>
</template>
```

Retry only work that may recover. For real requests, also pass an `AbortSignal` when navigation or
request cancellation should stop the operation.

## Check the production setup

```bash
npx nuxt typecheck
npx nuxt build
```

Kern's framework suite type-checks every mini-component, builds the Nuxt server, verifies the
validation page through SSR, and sends valid and invalid requests to the server example.
