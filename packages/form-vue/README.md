# @lithekit/form-vue

Vue 3.3+ composables for `@lithekit/form`. This package does not install React.

```bash
npm install @lithekit/form-vue
```

```ts
import { useField, useForm } from "@lithekit/form-vue"

const form = useForm({ schema: AccountSchema })
const email = useField("email")
```

`useForm()` exposes readonly Vue refs, provides the controller to descendants, watches its shallow
form ref, and disposes with the active scope. `useField()` accepts a string, ref, or reactive getter.
Imports are safe during SSR and hydration. Native controls remain DOM-owned and uncontrolled.

See the [Vue Form guide](https://sousaivan99.github.io/lithekit/modules/form/vue/).
