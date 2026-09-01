---
title: Form with Nuxt
description: Use the Vue adapter in hydrated Nuxt client forms.
---

Install the Vue adapter and whichever Standard Schema implementation the form uses. This example
uses Lithekit Validation:

```bash
npm install @lithekit/form-vue @lithekit/validation
```

The package is safe to import during Nuxt server rendering. DOM attachment begins only when the
template form ref resolves in the browser. Put `useForm()` in the component that owns the native
form and use `useField()` in descendants; normal Vue provide/inject supplies the controller.

<!-- framework-test: nuxt/app/components/AccountForm.vue -->
```vue
<script setup lang="ts">
import { object, string } from "@lithekit/validation"
import { useForm } from "@lithekit/form-vue"
import { ref } from "vue"

const AccountSchema = object({
  email: string().trim().email(),
})
const saved = ref("")
const account = useForm({
  initialValues: { email: "ada@example.com" },
  schema: AccountSchema,
})
const { formRef, submitting } = account
const submit = account.handleSubmit((output) => {
  saved.value = output.email
})
</script>

<template>
  <form ref="formRef" data-nuxt-form novalidate @submit="submit">
    <input name="email" type="email" />
    <span data-error-for="email" />
    <button :disabled="submitting">Save</button>
    <output data-nuxt-saved>{{ saved }}</output>
  </form>
</template>
```

Use server errors through `setErrors()` after catching the request failure. Do not combine the
adapter with `v-model` ownership of the same controls; Form 1.0 treats the native DOM as the value
source.
