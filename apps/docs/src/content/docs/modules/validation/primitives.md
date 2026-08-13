---
title: Validation primitives
description: Every string, number, boolean, date, literal, and enumeration rule in one place.
sidebar:
  order: 1
---

Primitive schemas check one runtime value. They never coerce another type into the expected one.

## String schema

Start with `string()`, then chain transformations and constraints in the order they should run:

```ts
import { string } from "@kern/core/validation"

const Username = string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-z][a-z0-9-]+$/u)

Username.parse(" kern-core ") // "kern-core"
```

All string-specific methods return another `StringSchema`, so they can be chained.

| Method | What it checks/does | Default issue code |
| --- | --- | --- |
| `.trim()` | Runs native `value.trim()` and changes output. | None |
| `.min(length, message?)` | Length is at least `length`. | `too_small` |
| `.max(length, message?)` | Length is at most `length`. | `too_big` |
| `.length(length, message?)` | Length equals `length`. | `invalid_length` |
| `.email(message?)` | Small structural email pattern. | `invalid_email` |
| `.url(message?)` | Accepted by native `new URL(value)`. | `invalid_url` |
| `.uuid(message?)` | UUID text with supported version/variant bits. | `invalid_uuid` |
| `.regex(pattern, message?)` | Matches the regular expression. | `invalid_string` |
| `.startsWith(prefix, message?)` | Starts with exact text. | `invalid_starts_with` |
| `.endsWith(suffix, message?)` | Ends with exact text. | `invalid_ends_with` |

Every optional `message` replaces only the human-readable message; the stable issue code remains
the same.

```ts
import { string } from "@kern/core/validation"

const Email = string().trim().email("Enter a valid email address")
const Website = string().url()
const RequestId = string().uuid()
const Prefix = string().startsWith("kern_")
const Suffix = string().endsWith("_prod")
const Exact = string().length(4)

console.log(Email.safeParse("ada@example.com"))
console.log(Website.safeParse("https://example.com"))
console.log(RequestId.safeParse("123e4567-e89b-42d3-a456-426614174000"))
console.log(Prefix.safeParse("kern_value"), Suffix.safeParse("api_prod"))
console.log(Exact.safeParse("kern"))
```

Important string boundaries:

- Length methods use JavaScript UTF-16 code units (`value.length`), not visible grapheme clusters.
- Length arguments must be non-negative safe integers or schema construction throws `RangeError`.
- `email()` checks useful syntax; it cannot verify ownership, existence, or deliverability.
- `url()` accepts every scheme supported by `URL`, including `javascript:`, `data:`, and `file:`.
  It is not a safe-link policy or sanitizer.
- `.regex()` clones the supplied expression and resets its `lastIndex`, so global/sticky state is
  not retained or written back to the caller's `RegExp`.
- `.trim()` is order-sensitive. `string().trim().min(2)` checks the trimmed length; putting `.min(2)`
  first checks the original length.

## Number schema

```ts
import { number } from "@kern/core/validation"

const Port = number().integer().positive().max(65_535).finite()
const Temperature = number().min(-100).max(100)

Port.parse(3000)
Temperature.parse(21.5)
```

| Method | What it checks | Default issue code |
| --- | --- | --- |
| `.min(value, message?)` | Input is `>= value`. | `too_small` |
| `.max(value, message?)` | Input is `<= value`. | `too_big` |
| `.positive(message?)` | Input is greater than zero. | `not_positive` |
| `.negative(message?)` | Input is less than zero. | `not_negative` |
| `.integer(message?)` | `Number.isInteger(input)`. | `not_integer` |
| `.finite(message?)` | `Number.isFinite(input)`. | `not_finite` |

`number()` rejects `NaN` as an invalid type. It accepts `Infinity` and `-Infinity` until
`.finite()` is added. Positive and negative exclude zero. `min`/`max` accept infinite boundaries but
reject a `NaN` boundary with `RangeError` during schema construction.

Number schemas do not enforce safe integers automatically. Use `.integer().refine(Number.isSafeInteger)`
when a domain value must fit the safe-integer range, or use the money helpers, which enforce it.

## Boolean schema

```ts
import { boolean } from "@kern/core/validation"

boolean().parse(true)
boolean().safeParse("true") // failure
```

`boolean()` accepts only the actual booleans `true` and `false`. It does not coerce strings,
numbers, or truthy/falsy values. A type mismatch uses `invalid_type`.

## Date schema

```ts
import { date } from "@kern/core/validation"

const Timestamp = date()
const createdAt = new Date("2026-08-13T12:00:00Z")

Timestamp.parse(createdAt) === createdAt // true
Timestamp.safeParse(new Date(Number.NaN)) // failure
Timestamp.safeParse("2026-08-13") // failure
```

`date()` accepts a valid native `Date` and returns that same instance; it does not clone or parse
strings. An invalid date or different type uses `invalid_type`.

## Literal schema

```ts
import { literal } from "@kern/core/validation"

const Ready = literal("ready")
const Nothing = literal(null)

Ready.parse("ready")
Nothing.parse(null)
```

`literal(value)` accepts one `string`, `number`, `bigint`, `boolean`, `null`, or `undefined` value.
Equality uses `Object.is`, so `literal(-0)` distinguishes `-0` from `0`, and `literal(Number.NaN)`
can match `NaN`. A mismatch uses `invalid_literal`.

## String enumeration

```ts
import { enumeration } from "@kern/core/validation"

const Role = enumeration(["member", "admin"] as const)

Role.parse("admin")
Role.safeParse("owner") // failure
```

`enumeration(values)` accepts one member of a non-empty readonly string tuple. `as const` preserves
the literal union `"member" | "admin"` instead of widening it to `string`. A mismatch uses
`invalid_enum`.

For mixed primitive values or non-string alternatives, use `union([literal(...), literal(...)])`.

## Type mismatch metadata

Primitive type issues use `invalid_type` and normally include:

- `expected`, a safe description such as `"string"`;
- `received`, a safe value kind such as `"array"`, `"null"`, `"date"`, or `"nan"`.

The rejected raw value is never stored in an issue.
