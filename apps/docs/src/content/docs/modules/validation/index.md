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

## Start here: a schema is a reusable set of rules

Imagine a form with one required name. The schema describes the rule; `safeParse()` applies it to a
real value:

```ts
import { object, string } from "@sousaivan/kern/validation"

const Person = object({
  name: string().trim().min(1),
})

const goodInput: unknown = { name: " Ada " }
const badInput: unknown = { name: "   " }
const success = Person.safeParse(goodInput)
const failure = Person.safeParse(badInput)

console.log("Success:", success)
console.log("Failure:", failure)
```

Read the schema from the outside inward:

1. `object({...})` says the input must be a plain object.
2. `name:` declares a property named `name`.
3. `string()` says that property must contain text, without converting another type.
4. `.trim()` removes surrounding whitespace from successful output.
5. `.min(1)` requires at least one UTF-16 code unit after trimming.
6. The `unknown` inputs say the external values have not been trusted yet.
7. A successful result contains `data`; a failed result contains an `issues` array explaining the
   problem and its path.

The schema is built once and can validate many inputs. Building it does not validate anything by
itself.

## Your first schema

```ts
import { enumeration, number, object, string } from "@sousaivan/kern/validation"

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
import { object, string } from "@sousaivan/kern/validation"

const Login = object({ email: string().email() })
const goodResult = Login.safeParse({ email: "ada@example.com" })
const badResult = Login.safeParse({ email: "not-an-email" })

console.log("Success:", goodResult)
console.log("Failure:", badResult)
```

`safeParse()` does not throw for an ordinary validation failure. Look at `success` first. When it is
`true`, use `data`. When it is `false`, show or handle the entries in `issues`.

Use `parse()` when invalid input means the current operation cannot continue:

```ts
import { object, string, ValidationError } from "@sousaivan/kern/validation"

const Login = object({ email: string().email() })

console.log("Success:", Login.parse({ email: "ada@example.com" }))

try {
  Login.parse({ email: "not-an-email" })
} catch (error) {
  if (error instanceof ValidationError) {
    console.log("Error message:", error.message)
    console.log("Error details:", error.issues)
  }
}
```

`parse()` returns the parsed value on success. On invalid input it throws `ValidationError`, so use
`try...catch` when your code needs to recover. The message is a short summary; `issues` contains the
structured paths and codes that application code can inspect.

| Method | Success | Ordinary invalid input | Invalid parse options |
| --- | --- | --- | --- |
| `safeParse` | `{ success: true, data }` | `{ success: false, issues }` | Throws `RangeError` |
| `parse` | Returns parsed output | Throws `ValidationError` | Throws `RangeError` |

Both methods infer the same output and accept `{ abortEarly?, maxIssues? }`.

## Schemas do not coerce by default

```ts
import { number } from "@sousaivan/kern/validation"

console.log("Success:", number().safeParse(42))
console.log("Failure:", number().safeParse("42"))
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
import { object, string } from "@sousaivan/kern/validation"

const User = object({ name: string() })

console.log("Stripped:", User.parse({ name: "Ada", admin: true }))
console.log("Rejected:", User.strict().safeParse({ name: "Ada", admin: true }))
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

## Common beginner mistakes

- A TypeScript interface or `as User` assertion performs no runtime validation. Use a schema for
  request bodies, JSON, forms, storage, and other external data.
- Schemas do not coerce. `number()` rejects `"42"`, and `boolean()` rejects `"true"`.
- `parse()` throws for invalid data. Use `safeParse()` when a user mistake is expected.
- `.optional()` accepts `undefined`/a missing object key; `.nullable()` accepts `null`. They are not
  interchangeable.
- Object schemas strip unknown keys by default. Use `.strict()` to reject them or `.passthrough()`
  only when retaining unchecked values is intentional.
- Modifier order matters. `string().trim().min(2)` checks trimmed text; reversing those calls checks
  length before trimming.
- A transform can return any value. Add a refinement when transformed output must satisfy another
  rule.

## Advanced usage

### Input and output can differ

Defaults and transforms can make a schema's accepted input different from its parsed output:

```ts
import { type InferInput, type InferOutput, object, string } from "@sousaivan/kern/validation"

const Settings = object({
  theme: string().default("system"),
  port: string().trim().transform(Number),
})

type SettingsInput = InferInput<typeof Settings>
type SettingsOutput = InferOutput<typeof Settings>

const input: SettingsInput = { port: "3000" }
const output: SettingsOutput = Settings.parse(input)
```

The [errors and inference guide](./errors-and-inference/) documents every public validation type,
bounded issue collection, and Standard Schema V1. The [collection guide](./collections/) covers
immutable object composition and unknown-key policies. The [modifiers guide](./modifiers-and-transforms/)
details type-guard refinements, callback failure isolation, and ordering.

### Security and work bounds

Issues never retain rejected values or callback/getter exceptions. Nested validators share one
issue limit, and `{ abortEarly: true }` stops after the first issue. These controls reduce
unnecessary work on hostile or very large payloads; application code must still limit request size
before parsing and decide which issue messages are safe to expose.
