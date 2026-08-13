---
title: Validation
description: Turn unknown runtime input into trusted, precisely inferred TypeScript values.
sidebar:
  order: 1
  label: Validation overview
---

TypeScript checks code while you develop, but its types disappear at runtime. Data from HTTP,
forms, JSON, storage, and environment variables can still have the wrong shape. A Kern schema checks
that data at runtime and tells TypeScript the output type after success.

## Your first schema

```ts
import { enumeration, number, object, string } from "@kern/core/validation"

const User = object({
  name: string().trim().min(2),
  email: string().trim().email(),
  age: number().integer().min(18).optional(),
  role: enumeration(["member", "admin"] as const).default("member"),
})

const user = User.parse({
  name: " Grace Hopper ",
  email: "grace@example.com",
})

console.log(user.name) // "Grace Hopper"
console.log(user.role) // "member"
```

You declared the rules once. That same `User` value provides:

- runtime validation;
- transformed/defaulted output;
- inferred input and output types;
- safe structured issues;
- schema composition methods;
- Standard Schema V1 interoperability.

Kern does not generate or auto-import a separate interface. Most code simply uses the type of the
parsed return value.

## `safeParse` or `parse`?

Use `safeParse()` when invalid input is an expected outcome:

```ts
import { object, string } from "@kern/core/validation"

const Login = object({ email: string().email() })
const input: unknown = { email: "not-an-email" }
const result = Login.safeParse(input)

if (result.success) {
  console.log(result.data.email)
} else {
  console.log(result.issues)
}
```

Use `parse()` when invalid input means the current operation cannot continue:

```ts
import { object, string, ValidationError } from "@kern/core/validation"

const Login = object({ email: string().email() })

try {
  const login = Login.parse({ email: "not-an-email" })
  console.log(login)
} catch (error) {
  if (error instanceof ValidationError) console.log(error.issues)
}
```

| Method | Success | Ordinary invalid input | Invalid parse options |
| --- | --- | --- | --- |
| `safeParse` | `{ success: true, data }` | `{ success: false, issues }` | Throws `RangeError` |
| `parse` | Returns parsed output | Throws `ValidationError` | Throws `RangeError` |

Both methods infer the same output and accept `{ abortEarly?, maxIssues? }`.

## Schemas do not coerce by default

```ts
import { number } from "@kern/core/validation"

number().safeParse(42) // success
number().safeParse("42") // failure: strings are not numbers
```

Use an explicit `.transform()` when conversion is part of your contract. Explicit conversion keeps
the accepted input type visible and avoids surprising values such as `Number("") === 0`.

## Available schema builders

| Builder | Accepts |
| --- | --- |
| `string()` | JavaScript strings |
| `number()` | Numbers except `NaN`; add `.finite()` to reject infinities |
| `boolean()` | `true` or `false` without coercion |
| `date()` | Valid native `Date` instances |
| `literal(value)` | One exact primitive literal |
| `enumeration(values)` | One string from a non-empty tuple |
| `array(schema)` | Arrays whose items match one schema |
| `tuple(schemas)` | Arrays with an exact length and per-position schemas |
| `object(shape)` | Plain objects with known fields |
| `record(schema)` | Plain objects with arbitrary string keys and one value schema |
| `union(schemas)` | A value matching at least one alternative |

Every schema supports `.optional()`, `.nullable()`, `.default()`, `.refine()`, `.transform()`,
`.parse()`, and `.safeParse()`.

## Unknown object keys

Object schemas strip unknown keys by default:

```ts
import { object, string } from "@kern/core/validation"

const User = object({ name: string() })

User.parse({ name: "Ada", admin: true }) // { name: "Ada" }
```

Use `.strict()` to reject them or `.passthrough()` to retain them. This policy is explicit and
preserved when object schemas are composed.

## Where to continue

1. [Primitive schemas](./primitives/) lists every primitive method, option, issue code, and edge case.
2. [Collection schemas](./collections/) explains nested paths, object composition, and unknown keys.
3. [Modifiers and transforms](./modifiers-and-transforms/) explains absence, defaults, callbacks,
   ordering, and input/output changes.
4. [Errors and inference](./errors-and-inference/) explains issue metadata, issue limits, named
   types, and Standard Schema.
