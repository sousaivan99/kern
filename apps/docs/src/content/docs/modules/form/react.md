---
title: Form with React
description: Use Lithekit Form through React hooks and the native Form wrapper.
---

```bash
npm install @lithekit/form-react
```

This installs Form core, not Vue. React 18 or newer is a peer dependency.

<!-- framework-test: react/src/form/AccountForm.tsx -->
```tsx
import { Form, useField, useForm } from "@lithekit/form-react"
import { object, string } from "@lithekit/validation"

const AccountSchema = object({
  email: string().trim().email(),
})

const saveAccount = async (account: { email: string }) => {
  await fetch("/api/account", { body: JSON.stringify(account), method: "POST" })
}

function EmailField() {
  const email = useField("email")

  return (
    <>
      <input name="email" type="email" aria-invalid={email.invalid || undefined} />
      <span data-error-for="email" />
    </>
  )
}

export function AccountForm() {
  const form = useForm({ schema: AccountSchema })

  return (
    <Form form={form} onSubmit={form.handleSubmit(saveAccount)}>
      <EmailField />
      <button disabled={form.submitting}>Save</button>
    </Form>
  )
}
```

`useForm()` creates one controller per mounted hook lifetime and returns primitive snapshots, stable
setters, and a callback `formRef`. State subscriptions use `useSyncExternalStore` with stable
snapshots. `<Form>` renders exactly one native form, provides context, merges refs and ordinary form
props, and keeps `noValidate` under controller ownership.

`useField()` belongs in a descendant of `<Form>` because the wrapper installs its controller through
React context. It listens only to field-specific state, so unrelated field changes do not rerender it.
The adapter supports server rendering, hydration, and Strict Mode. Controls remain DOM-owned and
uncontrolled; framework-controlled `value` and `checked` ownership is outside the stable contract.
