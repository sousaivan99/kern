---
title: Validation modifiers and transforms
description: Model undefined, null, defaults, custom rules, and output conversion precisely.
sidebar:
  order: 3
---

Every schema supports the modifiers on this page. They return new immutable schemas; the original
schema remains unchanged.

## At a glance

| Modifier | Accepted input change | Output change |
| --- | --- | --- |
| `.optional()` | Also accepts `undefined`/missing object key | Adds `undefined`; field becomes optional |
| `.nullable()` | Also accepts `null` | Adds `null`; field presence is unchanged |
| `.default(value)` | Also accepts `undefined`/missing key | Replaces `undefined`; field is required in output |
| `.refine(predicate, options?)` | No base-type change | Rejects values or narrows with a type guard |
| `.transform(callback)` | Preserves original input type | Replaces successful output type |

## Optional values

```ts
import { object, string } from "@sousaivan/kern/validation"

const Profile = object({ nickname: string().optional() })

console.log(Profile.safeParse({})) // success: {}
console.log(Profile.safeParse({ nickname: undefined })) // success: {}
console.log(Profile.safeParse({ nickname: "Ada" })) // success
console.log(Profile.safeParse({ nickname: 42 })) // failure
```

`.optional()` accepts `undefined`. In an object shape, it also makes the key optional. When the
parsed output is `undefined`, the object schema omits the key rather than creating
`{ nickname: undefined }`.

Outside an object, the parsed value itself can be `undefined`:

```ts
import { string } from "@sousaivan/kern/validation"

const OptionalText = string().optional()
console.log("Missing:", OptionalText.safeParse(undefined))
console.log("Text:", OptionalText.safeParse("Ada"))
console.log("Wrong type:", OptionalText.safeParse(42))
```

## Nullable values

```ts
import { object, string } from "@sousaivan/kern/validation"

const Profile = object({ middleName: string().nullable() })

console.log("Success:", Profile.safeParse({ middleName: null }))
console.log("Missing key:", Profile.safeParse({}))
console.log("Wrong type:", Profile.safeParse({ middleName: 42 }))
```

`.nullable()` accepts `null`; it says nothing about a key being missing. Use
`.nullable().optional()` when both absence and `null` are meaningful.

## Default values

```ts
import { object, string } from "@sousaivan/kern/validation"

const Account = object({ role: string().default("member") })

console.log(Account.safeParse({})) // success: { role: "member" }
console.log(Account.safeParse({ role: undefined })) // success: default applied
console.log(Account.safeParse({ role: "admin" })) // success
console.log(Account.safeParse({ role: 42 })) // failure
```

`.default(value)` accepts `undefined` as input and guarantees a non-`undefined` output. In an object,
the input key is optional but the output key is required.

The default cannot itself be `undefined`; attempting that throws `TypeError` while building the
schema. Kern returns the supplied default value directly—it does not clone objects or arrays—so use
an immutable value when a transformed schema has an object default.

When an entire object schema is made `.partial()`, missing defaulted fields remain absent. This
makes partial schemas suitable for update payloads.

## Add a custom constraint with `refine`

```ts
import { number, string } from "@sousaivan/kern/validation"

const Even = number().refine((value) => value % 2 === 0, "Expected an even number")

const Username = string().refine((value) => !value.includes("admin"), {
  code: "reserved_name",
  message: "This name is reserved",
})

console.log("Even success:", Even.safeParse(4))
console.log("Even failure:", Even.safeParse(3))
console.log("Username success:", Username.safeParse("ada"))
console.log("Username failure:", Username.safeParse("admin-user"))
```

`refine(predicate, options?)` first runs the schema before it. The predicate receives only a
successful parsed value.

| `options` form | Issue code | Message |
| --- | --- | --- |
| Omitted | `custom` | `Value did not satisfy refinement` |
| String | `custom` | The supplied string |
| `{ code?, message? }` | Supplied or `custom` | Supplied or default message |

A TypeScript type-guard predicate narrows the output:

```ts
import { number } from "@sousaivan/kern/validation"

type PositiveInteger = number & { readonly __kind: "PositiveInteger" }

const PositiveIntegerSchema = number().refine(
  (value): value is PositiveInteger => Number.isInteger(value) && value > 0,
)

const value: PositiveInteger = PositiveIntegerSchema.parse(2)
console.log(value)
```

The brand in this example is compile-time-only; validation is still defined by the predicate.

## Convert successful output with `transform`

```ts
import { string } from "@sousaivan/kern/validation"

const Port = string()
  .trim()
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value >= 1 && value <= 65_535, {
    code: "invalid_port",
    message: "Expected a TCP port from 1 to 65535",
  })

const port = Port.parse(" 3000 ") // number 3000
console.log("Success:", port)
console.log("Failure:", Port.safeParse("not-a-port"))
```

The accepted input remains a string, while the output becomes a number. A transform can return any
type. Kern does not automatically validate a transformed result; add a refinement or compose logic
inside the callback when needed.

Keep transforms focused and deterministic. They may run during form/RPC integration through
Standard Schema as well as direct parsing.

## Ordering matters

Modifiers wrap the schema in the order you call them. Compare:

```ts
import { string } from "@sousaivan/kern/validation"

const DefaultThenOptional = string().default("member").optional()
const OptionalThenDefault = string().optional().default("member")

console.log(DefaultThenOptional.safeParse(undefined)) // success: undefined
console.log(OptionalThenDefault.safeParse(undefined)) // success: "member"
console.log(OptionalThenDefault.safeParse(42)) // failure
```

Likewise, `string().trim().min(2)` validates the trimmed text, while
`string().min(2).trim()` checks the original length first.

A reliable reading rule is: start at the base schema and follow the chain from left to right.

## Callback failures are safe issues

If a refinement or transform callback throws, `safeParse()` catches it and returns a generic
`validation_exception` issue at the current path. The thrown exception and rejected raw value are
not retained.

```ts
import { string } from "@sousaivan/kern/validation"

const Explodes = string().transform(() => {
  throw new Error("private callback details")
})

console.log("Normal success:", string().safeParse("value"))
console.log("Callback failure:", Explodes.safeParse("value"))
```

`parse()` sees the same validation failure and throws `ValidationError`. Invalid parse controls such
as `maxIssues: 0` are programmer errors and still throw `RangeError` directly.
