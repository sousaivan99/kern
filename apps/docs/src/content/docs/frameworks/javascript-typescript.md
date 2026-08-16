---
title: JavaScript and TypeScript
description: Learn each Kern module through a small, independent JavaScript or TypeScript example.
---

Kern is an ESM package. Install it with your project's package manager:

```bash
npm install @sousaivan/kern
```

Each section below stands on its own. Start with the module that solves your current problem, copy
that example into a `.js`, `.mjs`, or `.ts` file, and change the sample values. You do not need to
learn or import every module at once.

## Validation: check unknown input

Use [`validation`](../../modules/validation/) for values your program does not control, such as
parsed JSON, form submissions, request bodies, and storage data.

<!-- framework-test: vanilla/javascript.mjs -->
```js
import { object, string } from "@sousaivan/kern/validation"

const Contact = object({
  name: string().trim().min(2),
  email: string().trim().email(),
})

const result = Contact.safeParse({
  name: " Ada Lovelace ",
  email: "ada@example.com",
})

if (result.success) {
  console.log(result.data) // { name: "Ada Lovelace", email: "ada@example.com" }
} else {
  console.log(result.issues)
}
```

`safeParse()` makes invalid input a normal result instead of throwing. Always check `success`
before reading `data` or `issues`.

## Money: add and display prices

Use [`money`](../../modules/money/) for financial amounts. Kern represents money as integer minor
units: `1099` commonly means €10.99 or $10.99 when the application stores cents.

<!-- framework-test: vanilla/examples/money.mjs -->
```js
import { formatMoney, sumMoney } from "@sousaivan/kern/money"

const pricesMinor = [1099, 250, 450]
const totalMinor = sumMoney(pricesMinor)

console.log(totalMinor) // 1799
console.log(formatMoney(totalMinor, "EUR", { locale: "en-GB" })) // "€17.99"
```

Keep the integer for calculations and format only for display. Do not pass `10.99` to a money
helper; pass `1099` when your chosen unit is cents.

## Date: create a new calendar date

Use [`date`](../../modules/date/) for small native `Date` operations. Helpers return new dates and
do not mutate the supplied date.

<!-- framework-test: vanilla/examples/date.mjs -->
```js
import { addDays, formatDate } from "@sousaivan/kern/date"

const orderedAt = new Date("2026-08-16T12:00:00Z")
const dispatchAt = addDays(orderedAt, 2)

console.log(
  formatDate(dispatchAt, {
    day: "numeric",
    locale: "en-GB",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }),
) // "18 Aug 2026"
console.log(orderedAt.toISOString()) // the original date is unchanged
```

An explicit `timeZone` keeps formatted output predictable across computers. Kern does not parse
ambiguous date strings or provide named-timezone calendar arithmetic.

## Number: calculate a percentage

Use [`number`](../../modules/number/) for ordinary counts, measurements, ranges, and percentages.
Use the money module instead for financial rounding.

<!-- framework-test: vanilla/examples/number.mjs -->
```js
import { formatPercentage, percentageOfTotal } from "@sousaivan/kern/number"

const completedTasks = 3
const totalTasks = 4
const percentage = percentageOfTotal(completedTasks, totalTasks)

console.log(percentage) // 75
console.log(formatPercentage(percentage, { locale: "en-GB" })) // "75%"
```

`percentageOfTotal()` returns percentage points, so `3` out of `4` returns `75`, not `0.75`.
Formatting creates a string meant for display.

## String: create a readable slug

Use [`string`](../../modules/string/) for focused text transformations. `slugify()` creates a
lowercase, diacritic-stripped route label.

<!-- framework-test: vanilla/examples/string.mjs -->
```js
import { slugify } from "@sousaivan/kern/string"

const title = "Crème Brûlée Course"
const slug = slugify(title)

console.log(slug) // "creme-brulee-course"
```

A readable slug is not guaranteed unique. Add a stable ID when two records may have the same name.

## Array: remove duplicate records

Use [`array`](../../modules/array/) when a small collection operation is meaningfully clearer than
writing it from scratch. `uniqueBy()` keeps the first item for each selected identity.

<!-- framework-test: vanilla/examples/array.mjs -->
```js
import { uniqueBy } from "@sousaivan/kern/array"

const products = [
  { id: "coffee", name: "Coffee" },
  { id: "tea", name: "Tea" },
  { id: "coffee", name: "Duplicate coffee" },
]

const uniqueProducts = uniqueBy(products, (product) => product.id)
console.log(uniqueProducts)
```

The source array is not changed. The result contains the first `coffee` and the first `tea`.

## Object: choose public fields

Use [`object`](../../modules/object/) for safe operations on known plain objects. `pick()` creates a
new object containing only the requested own properties.

<!-- framework-test: vanilla/examples/object.mjs -->
```js
import { pick } from "@sousaivan/kern/object"

const account = {
  id: "user-1",
  name: "Ada",
  internalNote: "Do not expose this",
}

const publicAccount = pick(account, ["id", "name"])
console.log(publicAccount) // { id: "user-1", name: "Ada" }
```

`pick()` does not validate values. Validate an unknown object first, then select fields from the
known result.

## Async: retry temporary failures

Use [`async`](../../modules/async/) for small Promise, timing, and scheduling operations. `retry()`
calls an operation again when it throws or rejects.

<!-- framework-test: vanilla/examples/async.mjs -->
```js
import { retry } from "@sousaivan/kern/async"

let calls = 0
const message = await retry(
  () => {
    calls += 1
    if (calls === 1) throw new Error("Temporary failure")
    return "Loaded"
  },
  { attempts: 3, delay: 10 },
)

console.log(message) // "Loaded"
console.log(calls) // 2
```

Retry only operations that can recover, such as a temporary network failure. Repeating a
deterministic validation failure will not make the input valid.

## TypeScript: infer a validated type

Kern includes its own type declarations. `Infer` derives a TypeScript type from the same schema
that checks values at runtime.

<!-- framework-test: vanilla/typescript.ts -->
```ts
import { object, string, type Infer } from "@sousaivan/kern/validation"

const Contact = object({
  name: string().trim().min(2),
  email: string().trim().email(),
})

type Contact = Infer<typeof Contact>

export function readContact(input: unknown): Contact {
  return Contact.parse(input)
}
```

Use `unknown` for untrusted values. After `parse()` succeeds, TypeScript knows the returned value is
a `Contact` without a manual type assertion.

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
