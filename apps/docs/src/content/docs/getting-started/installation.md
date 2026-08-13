---
title: Installation
description: Install Kern and select the smallest public entrypoint for your code.
sidebar:
  order: 1
---

Kern is published as the ESM-only package `@kern/core`. It has no runtime dependencies.

```bash
bun add @kern/core
```

The package also works with npm, pnpm, and yarn:

```bash
npm install @kern/core
```

## Requirements

| Environment | Supported baseline |
| --- | --- |
| TypeScript | 5.0 or newer |
| Node.js | 22 or newer |
| Bun | 1.3 or newer |
| Deno | Current stable |
| Browsers | Modern evergreen browsers with ES2022, `Intl`, and Web Abort APIs |

TypeScript projects must use `Bundler`, `Node16`, or `NodeNext` module resolution. CommonJS
`require()` and legacy `Node10` resolution are not supported.

## Prefer subpath imports

Import from the module that owns the operation:

```ts
import { addDays } from "@kern/core/date"
import { formatMoney } from "@kern/core/money"
import { object, string } from "@kern/core/validation"

const Account = object({ name: string().trim().min(2) })
const account = Account.parse({ name: " Ada " })

console.log(account.name, formatMoney(1999, "EUR"), addDays(new Date(), 1))
```

The root entrypoint remains available, but subpaths make boundaries explicit and reduce the chance
that an application or its tooling retains unrelated code.
