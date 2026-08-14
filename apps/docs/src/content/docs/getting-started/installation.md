---
title: Installation
description: Install Kern, configure TypeScript, and choose the right import path.
sidebar:
  order: 1
---

Kern is the ESM-only package `@sousaivan/kern`. It has no runtime dependencies and works with any
framework that can consume modern JavaScript modules.

Kern 1.x is the stable public API line. Patch releases fix compatible defects, minor releases add
backward-compatible capabilities, and major releases may require migrations.

## Install the package

Choose the command for your package manager:

```bash
bun add @sousaivan/kern
```

```bash
npm install @sousaivan/kern
```

```bash
pnpm add @sousaivan/kern
```

```bash
yarn add @sousaivan/kern
```

You do not need to install type packages. Kern includes its TypeScript declarations.

## Requirements

| Environment | Supported baseline | What that means |
| --- | --- | --- |
| TypeScript | 5.0 or newer | Inference and type tests support TypeScript 5+. |
| Node.js | 22 or newer | Use ESM imports, not CommonJS `require()`. |
| Bun | 1.3 or newer | Bun can run Kern directly. |
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

## Import from a module

Prefer the subpath that owns the helper:

```ts
import { addDays } from "@sousaivan/kern/date"
import { formatMoney } from "@sousaivan/kern/money"
import { object, string } from "@sousaivan/kern/validation"

const Account = object({ name: string().trim().min(2) })
const account = Account.parse({ name: " Ada " })

console.log(account.name)
console.log(formatMoney(1999, "EUR", { locale: "en-GB" }))
console.log(addDays(new Date(), 1))
```

The imports are ordinary JavaScript imports—Kern does not add framework plugins or auto-imports.
Subpath imports make ownership obvious and help bundlers discard modules you do not use.

The root entrypoint also works:

```ts
import { addDays, formatMoney, object, string } from "@sousaivan/kern"
```

Use it when convenience matters more than making module boundaries visible. Both forms are
side-effect free and tree-shakeable in supported bundlers.

## Confirm the setup

Create a small TypeScript file and run it with your normal toolchain:

```ts
import { object, string } from "@sousaivan/kern/validation"

const Greeting = object({ message: string().min(1) })
const result = Greeting.safeParse({ message: "Kern is ready" })

if (result.success) console.log(result.data.message)
else console.error(result.issues)
```

If your tool reports that it cannot resolve the package, first check that it uses modern module
resolution and ESM. Kern does not support legacy TypeScript `Node10` resolution or CommonJS
`require()`.
