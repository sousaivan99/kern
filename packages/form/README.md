# @lithekit/form

Framework-agnostic, DOM-first forms with Standard Schema validation and native accessibility.

```bash
npm install @lithekit/form
```

```ts
import { createForm } from "@lithekit/form"

const form = createForm({ schema: AccountSchema })
form.attach(document.querySelector("#account"))
document.querySelector("#account")?.addEventListener("submit", form.handleSubmit(saveAccount))
```

The controller has no runtime dependencies and structurally accepts synchronous or asynchronous
Standard Schema V1 schemas. It decodes native controls, protects nested path construction, handles
stale validation and submission races, and owns reversible ARIA/error-target updates while attached.
Input events decode only the affected control group, path-copy the changed draft branch, and notify
only the affected field signals. Full DOM discovery is reserved for lifecycle operations that need it.

Controls are DOM-owned and uncontrolled. Custom widgets, field arrays, decoder registries, and
framework-controlled value ownership are outside Form 1.0.

See the [native Form guide](https://sousaivan99.github.io/lithekit/modules/form/).
