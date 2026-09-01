---
title: Installation
description: Install Lithekit, configure TypeScript, and choose the right import path.
sidebar:
  order: 1
---

Lithekit is an ecosystem of ESM-only packages. Install only the domains your application uses.
There is no root aggregate package.

Lithekit 1.x is the stable public API line. Patch releases fix compatible defects, minor releases add
backward-compatible capabilities, and major releases may require migrations.

## Install packages

Choose the command for your package manager:

```bash
bun add @lithekit/validation @lithekit/money
```

```bash
npm install @lithekit/validation @lithekit/money
```

```bash
pnpm add @lithekit/validation @lithekit/money
```

```bash
yarn add @lithekit/validation @lithekit/money
```

You do not need to install type packages. Lithekit includes its TypeScript declarations.

## Requirements

| Environment | Supported baseline | What that means |
| --- | --- | --- |
| TypeScript | 5.0 or newer | Inference and type tests support TypeScript 5+. |
| Node.js | 22 or newer | Use ESM imports, not CommonJS `require()`. |
| Bun | 1.3 or newer | Bun can run Lithekit directly. |
| Deno | Current stable | Use the package through Deno's npm support. |
| Browsers | Modern evergreen | ES2022, `Intl`, and Web Abort APIs must be available. |

TypeScript projects must use `Bundler`, `Node16`, or `NodeNext` module resolution. A typical
application configuration looks like this:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "target": "ES2022"
  }
}
```

`strict: true` is recommended because it gives you the best schema inference and catches missing
null/undefined handling.

## Import from a package

Import from the installed package that owns the helper:

```ts
import { addDays } from "@lithekit/date"
import { formatMoney } from "@lithekit/money"
import { object, string } from "@lithekit/validation"

const Account = object({ name: string().trim().min(2) })
const account = Account.parse({ name: " Ada " })

console.log(account.name)
console.log(formatMoney(1999, "EUR", { locale: "en-GB" }))
console.log(addDays(new Date(), 1))
```

The imports are ordinary JavaScript imports—Lithekit does not add framework plugins or auto-imports.
Package imports make ownership explicit and ensure the package manager never downloads unrelated
domains or framework adapters. `@lithekit/form-vue` does not install React, and
`@lithekit/form-react` does not install Vue.

## Confirm the setup

Create a small TypeScript file and run it with your normal toolchain:

```ts
import { object, string } from "@lithekit/validation"

const Greeting = object({ message: string().min(1) })
const result = Greeting.safeParse({ message: "Lithekit is ready" })

if (result.success) console.log(result.data.message)
else console.error(result.issues)
```

If your tool reports that it cannot resolve the package, first check that it uses modern module
resolution and ESM. Lithekit does not support legacy TypeScript `Node10` resolution or CommonJS
`require()`.
