---
title: Nuxt
description: Use Kern directly in Nuxt components, server routes, SSR, and client bundles.
---

Install Kern in the Nuxt application:

```bash
npm install @sousaivan/kern
```

Kern needs no Nuxt module and no entry in `nuxt.config.ts`. Direct imports work in Vue components,
server routes, middleware, and other ESM files.

## Use Kern during rendering

The same helper can run during server-side rendering and in the browser after hydration.

<!-- framework-test: nuxt/app/app.vue -->
```vue
<script setup lang="ts">
import { formatMoney } from "@sousaivan/kern/money"

const total = formatMoney(12999, "EUR", { locale: "en-GB" })
</script>

<template>
  <main>
    <h1>Nuxt checkout</h1>
    <p data-testid="total">Total: {{ total }}</p>
  </main>
</template>
```

Pass a locale when SSR output must be deterministic. Otherwise, native `Intl` defaults can differ
between deployment environments.

## Validate a server request

Treat request bodies as untrusted. A server route can return Kern's structured issues without
placing the rejected value in the response.

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

The returned value is inferred as `{ name: string; email: string }`, and unknown object keys are
stripped by the object schema.

## Check the production setup

```bash
npx nuxt typecheck
npx nuxt build
```

Kern's framework test starts the generated Node server, verifies the SSR page, sends valid and
invalid requests to this endpoint, and then shuts the server down. It therefore exercises both
sides of the Nuxt application rather than only checking that compilation finishes.
