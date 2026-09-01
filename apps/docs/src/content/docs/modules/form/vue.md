---
title: Form with Vue
description: Use Lithekit Form through Vue-native refs and composables.
---

```bash
npm install @lithekit/form-vue
```

This installs Form core, not React. Vue 3.3 or newer is a peer dependency.

`EmailField.vue` reads the controller provided by the component that owns the form:

<!-- framework-test: vue/src/form/EmailField.vue -->
```vue
<script setup lang="ts">
import { useField } from "@lithekit/form-vue"

const { invalid } = useField("email")
</script>

<template>
  <input name="email" type="email" :aria-invalid="invalid || undefined" />
  <span data-error-for="email" />
</template>
```

The owning component creates the controller and exposes its refs as top-level setup bindings so Vue
can unwrap them in the template:

<!-- framework-test: vue/src/form/AccountForm.vue -->
```vue
<script setup lang="ts">
import { useForm } from "@lithekit/form-vue"
import { object, string } from "@lithekit/validation"
import EmailField from "./EmailField.vue"

const AccountSchema = object({
  email: string().trim().email(),
})
const form = useForm({ schema: AccountSchema })
const { formRef, submitting } = form
const submit = form.handleSubmit(async (account) => {
  await fetch("/api/account", { body: JSON.stringify(account), method: "POST" })
})
</script>

<template>
  <form ref="formRef" novalidate @submit="submit">
    <EmailField />
    <button :disabled="submitting">Save</button>
  </form>
</template>
```

`useForm()` creates the controller, provides it to descendants, exposes readonly Vue refs, watches
the shallow form ref, and disposes with the active effect scope. `useField()` accepts a string, ref,
or reactive getter and resubscribes when its canonical name changes. It belongs in a descendant
component and throws a clear error without an ancestor Lithekit form.

The adapter supports SSR and hydration because import and setup do not access the DOM. Controls are
DOM-owned and uncontrolled: stable ownership of `v-model`, `value`, or `checked` is not part of the
Form 1.0 contract.
