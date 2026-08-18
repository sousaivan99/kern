---
title: Vue
description: Learn each Kern module through a small, independent Vue component.
---

Install Kern in an existing Vue 3 project:

```bash
npm install @sousaivan/kern
```

No Vue plugin or `app.use()` call is required. Each section below is a separate single-file
component, so you can learn one module without first understanding the others.

## Validation: show form feedback

Use [`validation`](../../modules/validation/) with a computed result. `safeParse()` is a good fit
because an invalid value is normal while someone edits a form.

<!-- framework-test: vue/src/App.vue -->
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
    <h1>Contact form</h1>
    <label>
      Email
      <input v-model="email" name="email" type="email" />
    </label>
    <p aria-live="polite">{{ message }}</p>
  </main>
</template>
```

The schema is an immutable ordinary value, so it does not need `ref()` or `reactive()`. The computed
values stay synchronized with the editable email.

## Money: render an order total

Use [`money`](../../modules/money/) for prices stored as integer minor units. Calculate the integer
total first and format it only for the template.

<!-- framework-test: vue/src/examples/MoneyExample.vue -->
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

Keep `1799` in application state rather than the formatted `"€17.99"`. Display strings are not
safe inputs for later arithmetic.

## Date: display a delivery date

Use [`date`](../../modules/date/) for small native `Date` operations. `addDays()` returns a new date
and leaves `orderedAt` unchanged.

<!-- framework-test: vue/src/examples/DateExample.vue -->
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

Explicit locale and timezone options keep SSR and browser output predictable.

## Number: render progress

Use [`number`](../../modules/number/) for counts, measurements, and percentages. Calculate with
numbers before creating localized display text.

<!-- framework-test: vue/src/examples/NumberExample.vue -->
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

`percentageOfTotal(3, 4)` returns `75`. Use the money module instead for financial calculations.

## String: create a product route

Use [`string`](../../modules/string/) for focused text transformations. Derive a readable slug but
keep the original name for display.

<!-- framework-test: vue/src/examples/StringExample.vue -->
```vue
<script setup lang="ts">
import { slugify } from "@sousaivan/kern/string"

const product = { id: "course-1", name: "Crème Brûlée Course" }
const slug = slugify(product.name)
</script>

<template>
  <a :href="`/products/${product.id}-${slug}`">{{ product.name }}</a>
</template>
```

The ID makes the route unique even when two products have the same readable name.

## Array: render unique records

Use [`array`](../../modules/array/) before `v-for` when a collection needs a semantic operation.
`uniqueBy()` keeps the first product for each ID.

<!-- framework-test: vue/src/examples/ArrayExample.vue -->
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

The input array is unchanged. If `inventory` is reactive, place the transformation in a
`computed()` value so Vue can cache unchanged reads.

## Object: create a public view model

Use [`object`](../../modules/object/) to copy deliberate fields from a known plain object. The
template never receives the internal note.

<!-- framework-test: vue/src/examples/ObjectExample.vue -->
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

`pick()` selects fields but does not validate their values. Validate unknown API data first.

## Async: debounce a search value

Use [`async`](../../modules/async/) for scheduling and Promise control flow. Connect scheduled work
to Vue's component lifecycle.

<!-- framework-test: vue/src/examples/AsyncExample.vue -->
```vue
<script setup lang="ts">
import { onUnmounted, ref } from "vue"
import { debounce } from "@sousaivan/kern/async"

const query = ref("")
const settledQuery = ref("")
const updateLater = debounce((value: string) => {
  settledQuery.value = value
}, 250)

const updateQuery = (event: Event): void => {
  const value = (event.currentTarget as HTMLInputElement).value
  query.value = value
  updateLater(value)
}

onUnmounted(updateLater.cancel)
</script>

<template>
  <label>
    Search
    <input :value="query" @input="updateQuery" />
    <span>Searching for: {{ settledQuery || "nothing yet" }}</span>
  </label>
</template>
```

The input updates immediately, while `settledQuery` waits until typing pauses. Cleanup prevents a
pending callback from updating an unmounted component.

## Check the production setup

Vite transpiles TypeScript but does not type-check it. Run both commands:

```bash
npx vue-tsc --noEmit
npm run build
```

Kern's framework suite type-checks every mini-component against the packed package. It also builds
client and SSR bundles and exercises the validation example in Chromium.
