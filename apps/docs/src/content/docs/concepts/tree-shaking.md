---
title: Tree-shaking and size
description: How Kern's ESM entrypoints preserve small consumer bundles.
---

Every module is an independent ESM entrypoint and the package declares `sideEffects: false`.
Prefer the narrowest import:

```ts
import { formatMoney } from "@kern/core/money"

export const displayPrice = (minorUnits: number): string =>
  formatMoney(minorUnits, "EUR", { locale: "en-GB" })
```

Kern has no import-time side effects. Build checks bundle each entrypoint independently, minify it,
gzip it, and compare it with the module's size budget. Approximate budgets are 5 KB for validation,
2.5 KB for finance-capable money, 2 KB for date and string, and hundreds of bytes to a few
kilobytes for smaller modules.

Correctness is never removed to meet a benchmark or byte target. A significant increase is
investigated and justified rather than silently accepted.
