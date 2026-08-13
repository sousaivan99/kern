---
title: Native first
description: Understand when Kern helps and when plain JavaScript is already the better tool.
---

Kern builds on JavaScript and Web APIs instead of hiding them. A public helper is added only when it
does at least one of these things:

1. removes meaningful repeated boilerplate;
2. improves TypeScript narrowing or inference; or
3. prevents a common correctness mistake.

It must also remain small, predictable, framework-agnostic, and owned by one clear module.

## Learn the native foundation

Kern relies on APIs such as `Intl`, `URL`, `AbortController`, `Promise`, `Map`, `Set`,
`Object.hasOwn`, and `Array.prototype.at`. Knowing the native API makes Kern easier to understand.

Some helpers are semantic names around short native expressions:

| Kern | Native expression | Why Kern may read better |
| --- | --- | --- |
| `first(values)` | `values[0]` | Communicates intent and improves known-tuple typing. |
| `last(values)` | `values.at(-1)` | Avoids index arithmetic and improves known-tuple typing. |
| `unique(values)` | `[...new Set(values)]` | Gives the operation a searchable name. |
| `withoutFalsy(values)` | `values.filter(Boolean)` | Narrows statically representable falsy values. |
| `isBefore(a, b)` | `a.getTime() < b.getTime()` | Validates dates and names instant comparison. |
| `formatNumber(value)` | `new Intl.NumberFormat().format(value)` | Colocates locale with native options. |

```ts
import { first, unique } from "@kern/core/array"

const runtimes = unique(["Bun", "Node", "Bun"])
const primary = first(runtimes)

console.log(primary, runtimes)
```

## When plain JavaScript is better

Do not search for a Kern helper when native code is already obvious:

```ts
const values = [1, 2, 3]
const users = [
  { id: 1, active: true },
  { id: 2, active: false },
]

const doubled = values.map((value) => value * 2)
const active = users.filter((user) => user.active)
const ids = new Set(users.map((user) => user.id))

console.log(doubled, active, ids)
```

Kern intentionally does not provide wrappers named `map`, `filter`, or `set` for these operations.

## Deliberate limits

Kern is not a feature-for-feature replacement for Lodash, Zod, date-fns, a finance platform, or a
timezone engine. It avoids:

- arbitrary object-path writes that can create prototype-pollution risks;
- application-specific validation rules;
- hidden money currencies or provider-specific currency tables;
- general timezone arithmetic;
- wrappers that only make native code longer;
- framework plugins and import-time behavior.

The result is a smaller API where each helper has a contract that can be fully explained and
tested.
