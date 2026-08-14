---
title: Core ideas
description: Six simple concepts that make every Kern module predictable.
sidebar:
  order: 3
---

You do not need advanced TypeScript knowledge to use Kern. These six ideas explain most of the
library.

## 1. Import from the module you need

```ts
import { unique } from "@sousaivan/kern/array"
import { formatMoney } from "@sousaivan/kern/money"
```

Kern groups helpers by responsibility. A money helper will not secretly validate an application
model, and a date helper will not silently perform timezone conversion.

## 2. Untrusted input starts as `unknown`

`unknown` means “TypeScript does not know what this is yet.” Validate it before using it:

```ts
import { object, string } from "@sousaivan/kern/validation"

const Message = object({ text: string().min(1) })
const input: unknown = JSON.parse('{"text":"hello"}')
const message = Message.parse(input)

console.log(message.text)
```

This is safer than `as Message`, which only silences TypeScript and performs no runtime check.

## 3. Functions do not mutate your input

Unless an API explicitly says otherwise, Kern returns a new value:

```ts
import { addDays } from "@sousaivan/kern/date"
import { unique } from "@sousaivan/kern/array"

const originalDate = new Date(2026, 0, 1)
const laterDate = addDays(originalDate, 3)

const originalNames = ["Ada", "Grace", "Ada"]
const distinctNames = unique(originalNames)

console.log(originalDate !== laterDate, originalNames !== distinctNames)
```

`deepFreeze()` is the deliberate exception: freezing is its stated purpose, so it freezes the
validated object graph in place and returns that same graph with a deeply readonly type.

## 4. Units and defaults are explicit

- Money uses integer minor units, never ambiguous decimal “money numbers.”
- Date arithmetic says whether it uses local calendar time, an instant, a named display timezone,
  or UTC.
- Percentage arguments use percentage points: `15` means 15%.
- Locale-sensitive output takes an explicit `locale` option when predictability matters.
- Validation aggregates issues and strips unknown object keys by default.

These defaults make simple code safe, while named options expose advanced behavior.

## 5. Expected failure is data; programmer mistakes throw

A validation failure is normal data:

```ts
import { object, string } from "@sousaivan/kern/validation"

const Message = object({ text: string().min(1) })
const result = Message.safeParse({ text: "" })

if (!result.success) console.log(result.issues)
```

Invalid API configuration—such as a negative chunk size or `maxIssues: 0`—throws `RangeError`.
Unsupported input objects for a narrowly defined object helper may throw `TypeError`. Each module
page lists these cases.

## 6. Start simple, customize progressively

The common path should stay short:

```ts
import { string } from "@sousaivan/kern/validation"

const Name = string().trim().min(2)
```

Add customization only when the application needs it:

```ts
import { string } from "@sousaivan/kern/validation"

const Name = string()
  .trim()
  .min(2, "Please enter at least two characters")
  .refine((value) => !value.includes("admin"), {
    code: "reserved_name",
    message: "This name is reserved",
  })
```

Junior developers can rely on clear defaults and copyable patterns. Senior developers can compose
schemas, control issue collection, choose exact money rounding, and pass native `Intl` options
without switching to a different API.
