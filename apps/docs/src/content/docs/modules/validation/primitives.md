---
title: Validation primitives
description: Validate strings, numbers, booleans, dates, literals, and finite string enumerations.
sidebar:
  order: 1
---

## Strings

```ts
import { string } from "@kern/core/validation"

const Identifier = string().trim().min(3).max(32).regex(/^[a-z][a-z0-9-]+$/u)
const Email = string().trim().email()
const Website = string().url()
const RequestId = string().uuid()
const Prefix = string().startsWith("kern_")
const Suffix = string().endsWith("_prod")
const Exact = string().length(4)

console.log(
  Identifier.parse(" kern-core "),
  Email.parse("ada@example.com"),
  Website.parse("https://example.com"),
  RequestId.safeParse("123e4567-e89b-42d3-a456-426614174000"),
  Prefix.safeParse("kern_value"),
  Suffix.safeParse("api_prod"),
  Exact.safeParse("kern"),
)
```

String lengths use UTF-16 code units. `email()` is a small structural check, not delivery
verification. `url()` accepts every scheme supported by `new URL`, including non-HTTP schemes, and
is not a safe-link policy. Regular expressions are cloned so their `lastIndex` is not mutated.

## Numbers and other primitives

```ts
import { boolean, date, enumeration, literal, number } from "@kern/core/validation"

const Port = number().integer().positive().max(65_535).finite()
const Temperature = number().min(-100).max(100)
const Negative = number().negative()
const Enabled = boolean()
const Timestamp = date()
const Exact = literal("ready")
const Role = enumeration(["member", "admin"] as const)

console.log(Port.safeParse(3000), Temperature.safeParse(21.5), Negative.safeParse(-1))
console.log(Enabled.safeParse(true), Timestamp.safeParse(new Date()), Exact.safeParse("ready"))
console.log(Role.safeParse("admin"))
```

Number schemas reject `NaN` but allow infinities until `.finite()` is applied. Date schemas require
a valid native `Date` and preserve its identity. Literal equality uses `Object.is`; enumeration
requires a non-empty readonly tuple of strings.
