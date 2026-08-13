---
title: Native first
description: Why Kern stays small and when a semantic helper earns a place in the package.
---

Kern uses native JavaScript and Web APIs first. A public helper is admitted only when it removes
meaningful boilerplate, improves TypeScript narrowing, or prevents a common correctness error.
It must also remain small, predictable, and clearly owned by one module.

Native APIs such as `Intl`, `URL`, `AbortController`, `Promise`, `Map`, `Set`, and
`structuredClone` remain the foundation. Kern does not wrap them merely to grow its API or to
replace a readable one-line native expression.

## Readability wrappers

Some tiny operations have useful semantic names. Their documentation always shows the native
equivalent:

| Kern | Native expression |
| --- | --- |
| `first(values)` | `values[0]` |
| `last(values)` | `values.at(-1)` |
| `unique(values)` | `[...new Set(values)]` |
| `withoutFalsy(values)` | `values.filter(Boolean)` |
| `isBefore(left, right)` | `left.getTime() < right.getTime()` |
| `formatNumber(value)` | `new Intl.NumberFormat().format(value)` |

```ts
import { first, unique } from "@kern/core/array"

const runtimes = unique(["Bun", "Node", "Bun"])
const primary = first(runtimes)

console.log(primary, runtimes)
```

## Deliberate limits

Kern is not a feature-for-feature replacement for Lodash, Zod, or date-fns. It avoids ambiguous
units, arbitrary object-path writes, general timezone arithmetic, application-specific validation,
and broad convenience surfaces that native code already expresses well.
