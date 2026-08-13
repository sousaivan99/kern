---
title: JavaScript and TypeScript
description: Install Kern in a JavaScript or TypeScript project and validate untrusted input.
---

Kern is an ordinary ESM package. It does not require a plugin, code generator, or global setup.
Install it with your project's package manager:

```bash
npm install @kern/core
```

Prefer module subpaths so each import communicates what it owns and remains easy to tree-shake.

## JavaScript

Use ESM `import` syntax in a `.js` or `.mjs` file. Validation is still useful in JavaScript because
it checks values at runtime.

<!-- framework-test: vanilla/javascript.mjs -->
```js
import { formatMoney } from "@kern/core/money"
import { object, string } from "@kern/core/validation"

const Contact = object({
  name: string().trim().min(2),
  email: string().trim().email(),
})

const result = Contact.safeParse({
  name: " Ada Lovelace ",
  email: "ada@example.com",
})

if (!result.success) throw new Error(result.issues[0]?.message ?? "Invalid contact")

console.log(`${result.data.name}: ${formatMoney(12999, "EUR", { locale: "en-GB" })}`)
```

Run it with Node.js or Bun:

```bash
node example.mjs
bun example.mjs
```

## TypeScript

Kern includes its own declarations. No `@types` package is needed, and successful parsing narrows
the result without a type assertion.

<!-- framework-test: vanilla/typescript.ts -->
```ts
import { object, string, type Infer } from "@kern/core/validation"

const Contact = object({
  name: string().trim().min(2),
  email: string().trim().email(),
})

type Contact = Infer<typeof Contact>

export function readContact(input: unknown): Contact {
  return Contact.parse(input)
}

console.log(readContact({ name: " Grace Hopper ", email: "grace@example.com" }).name)
```

Use `unknown` for request bodies, parsed JSON, storage values, and other untrusted data. Kern checks
the value before TypeScript treats it as `Contact`.

## Module configuration

Modern application scaffolds normally need no changes. If you maintain `tsconfig.json` yourself,
use modern ESM and module resolution:

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

Kern does not support CommonJS `require()` or legacy `Node10` TypeScript resolution.

