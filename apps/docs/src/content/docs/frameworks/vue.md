---
title: Vue
description: Validate a Vue form and format application values with direct Kern imports.
---

Install Kern in an existing Vue 3 project:

```bash
npm install @kern/core
```

No Vue plugin or `app.use()` call is required. Import helpers inside a component, composable, or
store exactly where they are used.

## Validate a form

This component keeps the editable value as a string and derives a validation result. It uses
`safeParse()` because invalid form input is expected and should be shown to the person filling in
the form.

<!-- framework-test: vue/src/App.vue -->
```vue
<script setup lang="ts">
import { computed, ref } from "vue"
import { formatMoney } from "@kern/core/money"
import { object, string } from "@kern/core/validation"

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
const total = formatMoney(12999, "EUR", { locale: "en-GB" })
</script>

<template>
  <main>
    <h1>Contact checkout</h1>
    <label>
      Email
      <input v-model="email" name="email" type="email" />
    </label>
    <p aria-live="polite">{{ message }}</p>
    <p>Total: {{ total }}</p>
  </main>
</template>
```

Kern schemas are ordinary values, so define a schema outside the component when several component
instances can share it. No reactive wrapper is needed around an immutable schema.

## Check the production setup

Vite transpiles TypeScript but does not type-check it. Keep Vue's type-check command alongside the
production build:

```bash
npx vue-tsc --noEmit
npm run build
```

The Kern release suite runs both checks against this component and also renders its production SSR
bundle. This catches package-resolution, Vue SFC, browser-bundle, and server-rendering regressions.

