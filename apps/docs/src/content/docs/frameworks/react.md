---
title: React
description: Validate controlled React form state with inferred Kern schemas.
---

Install Kern in an existing React application:

```bash
npm install @kern/core
```

Kern does not need a provider, hook, or React adapter. Schemas are immutable ordinary values and
can be declared once outside the component.

## Validate controlled state

<!-- framework-test: react/src/App.tsx -->
```tsx
import { useState } from "react"
import { formatMoney } from "@kern/core/money"
import { object, string } from "@kern/core/validation"

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
      <h1>Contact checkout</h1>
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
      <p>Total: {formatMoney(12999, "EUR", { locale: "en-GB" })}</p>
    </main>
  )
}
```

Use `safeParse()` for interactive input. Use `parse()` at boundaries where invalid input is
exceptional and your error handling is designed to catch `ValidationError`.

Kern has no module-level browser state, so the same imports can also be used in server-rendered
React environments. Helpers using `Date` or `Intl` still follow the host environment, so pass
explicit locale and timezone options when output must match between server and browser.

## Check the production setup

In a Vite React project, run both TypeScript and the production compiler:

```bash
npx tsc --noEmit
npm run build
```

Kern's release suite runs those checks against this component and renders a production SSR bundle.
That verifies TypeScript inference, JSX compilation, client bundling, and server rendering.

