---
title: Tree-shaking and bundle size
description: Import only what you use and understand Kern's enforced size limits.
---

Tree-shaking is a build step that removes exported code your application never uses. Kern is
designed so modern bundlers can do this reliably.

## Prefer module imports

```ts
import { formatMoney } from "@sousaivan/kern/money"

export const displayPrice = (minorUnits: number): string =>
  formatMoney(minorUnits, "EUR", { locale: "en-GB" })
```

This import says the file depends on the money module. It cannot accidentally pull validation,
date, or async helpers into the source graph.

The root import is also tree-shakeable in supported tooling:

```ts
import { formatMoney } from "@sousaivan/kern"
```

Subpaths are still preferred because they communicate ownership to readers and work well with a
wider range of build configurations.

## Why Kern can be tree-shaken

- Every module has an independent ESM entrypoint.
- The package declares `sideEffects: false`.
- Importing Kern does not register globals, patch prototypes, start timers, or read configuration.
- Runtime modules have no dependencies that can introduce hidden side effects.

Tree-shaking depends on your bundler and build mode. Development builds often retain more code for
debugging, so compare production bundles when measuring size.

## Enforced budgets

Kern's build checks bundle, minify, gzip, and measure every public entrypoint.

| Module | Approximate gzip budget |
| --- | ---: |
| Validation | below 5 KB |
| Money | at most 3.125 KB |
| Date | below 2 KB |
| String | below 2 KB |
| Small helper modules | usually hundreds of bytes to a few KB |

These budgets prevent accidental growth; they do not override correctness. A size increase is
investigated and justified rather than “fixed” by removing validation or safety behavior.

See [Package size](../../measurements/package-size/) for current byte counts, realistic validation
fixtures, exact package versions, and reproduction commands.

## Practical guidance

1. Import from the narrow module.
2. Build your application in production mode.
3. Use your bundler's analyzer when bundle size changes unexpectedly.
4. Check that transpilation has not converted ESM imports to CommonJS.
5. Avoid namespace imports such as `import * as Kern` unless you genuinely use a dynamic namespace.
