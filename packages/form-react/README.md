# @lithekit/form-react

React 18+ hooks and components for `@lithekit/form`. This package does not install Vue.

```bash
npm install @lithekit/form-react
```

```tsx
import { Form, useField, useForm } from "@lithekit/form-react"

const form = useForm({ schema: AccountSchema })
const email = useField("email")

return <Form form={form}><input name="email" /></Form>
```

State uses `useSyncExternalStore`; field hooks subscribe only to field-specific signals. The native
`<Form>` wrapper merges refs, provides context, and keeps `noValidate` under controller ownership.
Imports support SSR, hydration, and Strict Mode. Controls remain DOM-owned and uncontrolled.

See the [React Form guide](https://sousaivan99.github.io/lithekit/modules/form/react/).
