---
title: Validation errors and inference
description: Read every issue field, bound validation work, reuse inferred types, and interoperate.
sidebar:
  order: 4
---

## The safe-parse result

`safeParse()` returns a discriminated union. Check `success` before accessing `data` or `issues`:

```ts
import { array, number, object, string } from "@kern/core/validation"

const Users = array(object({ email: string().email(), age: number().min(18) }))
const success = Users.safeParse([{ email: "ada@example.com", age: 36 }])
const failure = Users.safeParse([{ email: "invalid", age: 12 }])

console.log("Success:", success)

if (!failure.success) {
  for (const issue of failure.issues) {
    console.log(issue.path, issue.code, issue.message)
  }
}
```

There is no `.errors` property. Failures use `.issues` consistently on safe results and
`ValidationError`.

## Every issue field

```ts
import type { ValueKind } from "@kern/core/validation"

interface ValidationIssue {
  readonly path: readonly (string | number)[]
  readonly code: string
  readonly message: string
  readonly expected?: string
  readonly received?: ValueKind
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
}
```

| Field | Always present? | Purpose |
| --- | --- | --- |
| `path` | Yes | Location from the root input, such as `["users", 0, "email"]`. |
| `code` | Yes | Stable machine-readable category for application logic. |
| `message` | Yes | Human-readable default/custom explanation. |
| `expected` | No | Safe expected-kind description. |
| `received` | No | Safe category of the received value. |
| `details` | No | Primitive-only metadata such as `{ minimum: 2 }`. |

`ValueKind` can be `"array"`, `"bigint"`, `"boolean"`, `"date"`, `"function"`, `"nan"`,
`"null"`, `"number"`, `"object"`, `"string"`, `"symbol"`, or `"undefined"`.

Issues never contain the rejected raw value or a callback/getter exception. This reduces accidental
retention of passwords, tokens, large payloads, and internal exception details. You must still
decide whether issue paths/messages are appropriate to log or show publicly.

## Built-in issue codes

| Code | Common source |
| --- | --- |
| `required` | Missing required object field |
| `invalid_type` | Wrong primitive/collection type or invalid `Date`/`NaN` number |
| `too_small`, `too_big`, `invalid_length` | String/number/tuple size constraints |
| `invalid_email`, `invalid_url`, `invalid_uuid`, `invalid_string` | String formats/regex |
| `invalid_starts_with`, `invalid_ends_with` | String prefix/suffix |
| `not_positive`, `not_negative`, `not_integer`, `not_finite` | Number constraints |
| `invalid_literal`, `invalid_enum`, `invalid_union` | Alternative/value selection |
| `unrecognized_key` | Strict object unknown field |
| `custom` or your code | Refinement failure |
| `validation_exception` | Callback failure, hostile getter, or unexpected validator exception |

Codes are intended for control flow and translation keys. Messages are intended for people and may
be customized.

## Advanced: control how many issues are collected

Validation aggregates all reachable issues by default. Nested arrays, objects, tuples, and records
share the same limit.

```ts
import { array, object, string } from "@kern/core/validation"

const Users = array(object({ name: string().min(2), email: string().email() }))
const input = [
  { name: "", email: "bad" },
  { name: "", email: "bad" },
]

const all = Users.safeParse(input)
const first = Users.safeParse(input, { abortEarly: true })
const bounded = Users.safeParse(input, { maxIssues: 3 })

console.log(all, first, bounded)
```

`ParseOptions`:

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `abortEarly` | `boolean` | `false` | Effective issue limit becomes one. |
| `maxIssues` | positive safe integer | Unlimited | Stop work once this total is reached. |

If both are supplied, `abortEarly: true` wins and the effective limit is one. `maxIssues` values of
zero, negative, fractional, `NaN`, infinite, or unsafe throw `RangeError`—even from `safeParse()`.
These are invalid API controls, not ordinary validation failures.

Bounded validation helps protect APIs from spending unnecessary work on very large invalid
payloads. The issue order remains deterministic: known object fields follow shape order, then
unknown input keys follow their enumeration order.

## Thrown parsing with `ValidationError`

```ts
import { object, string, ValidationError } from "@kern/core/validation"

const User = object({ email: string().email() })

console.log("Success:", User.parse({ email: "ada@example.com" }))

try {
  User.parse({ email: "invalid" })
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.name) // "ValidationError"
    console.log(error.message) // first issue message
    console.log(error.issues) // all collected issues
  }
}
```

`ValidationError.issues` is readonly. The error message is the first issue's message, or
`"Validation failed"` if no issue is available.

## Advanced: input and output inference

The general schema type is `Schema<Output, Input = Output, Presence = "required">`.

- `Output` is what successful parsing returns.
- `Input` is what the schema is intended to accept before parsing.
- `Presence` tracks required, optional, or defaulted object-field behavior.

Most functions should use return-value inference directly:

```ts
import { object, string } from "@kern/core/validation"

const User = object({ name: string().trim() })
const user = User.parse({ name: " Ada " })

function greet(value: typeof user): string {
  return `Hello ${value.name}`
}

console.log(greet(user))
```

When a reusable named type is genuinely useful, use the inference aliases:

```ts
import { type Infer, type InferInput, type InferOutput, object, string } from "@kern/core/validation"

const Account = object({
  name: string().trim(),
  role: string().default("member"),
  port: string().trim().transform(Number),
})

type AccountInput = InferInput<typeof Account>
type AccountOutput = InferOutput<typeof Account>
type AccountAlias = Infer<typeof Account>

const input: AccountInput = { name: " Ada ", port: "3000" }
const output: AccountOutput = Account.parse(input)
const sameOutput: AccountAlias = output

console.log(sameOutput)
```

Here `role` is optional in `AccountInput` but required in output, and `port` changes from string
input to number output. `Infer<S>` is exactly the convenient output alias.

## Advanced: Standard Schema V1

Every Kern schema implements synchronous Standard Schema V1 through the `~standard` property:

```ts
import { object, string } from "@kern/core/validation"

const User = object({ email: string().email() })
const standard = User["~standard"]
const success = standard.validate(
  { email: "ada@example.com" },
  { libraryOptions: { source: "form" } },
)
const failure = standard.validate(
  { email: "not-an-email" },
  { libraryOptions: { source: "form" } },
)

console.log(standard.version) // 1
console.log(standard.vendor) // "kern"
console.log("Success:", success)
console.log("Failure:", failure)
```

The validator returns `{ value }` on success or `{ issues }` on failure. It is synchronous, uses
Kern's parsed/transformed output, and passes Kern issue paths through unchanged. Standard
Schema-aware form, RPC, and validation tools can consume it without an adapter or external runtime
dependency.

Standard Schema permits a library-specific options bag and permits validators to return a promise.
Kern accepts the current V1 options argument for compatibility, ignores `libraryOptions`, and always
returns its result synchronously. Consumer code written for any Standard Schema implementation must
still allow either a direct result or a promise.

The exported `StandardSchemaV1<Input, Output>` interface includes the official nested result,
issue, path, options, types, and inference members. Most applications should pass the schema itself
to a Standard Schema-aware tool instead of calling these lower-level types directly.

Direct `~standard.validate()` uses Kern's default issue aggregation and does not expose Kern-specific
`abortEarly`/`maxIssues` controls. Call `safeParse()` directly when you need those controls.

## Exported validation types

Most applications need only `Infer`, `InferInput`, `InferOutput`, `ValidationIssue`, and possibly
`SafeParseResult`. The rest are available for libraries and advanced abstractions.

| Type | Purpose |
| --- | --- |
| `Schema<Output, Input, Presence>` | Public contract implemented by every schema. |
| `AnySchema` | Any Kern schema regardless of its input/output. |
| `StringSchema` | A string schema with `.trim()`, length, format, regex, prefix, and suffix methods. |
| `NumberSchema` | A number schema with range, sign, integer, and finite-number methods. |
| `Infer<S>` | Convenient alias for a schema's output. |
| `InferInput<S>` | Input accepted before parsing/transformation. |
| `InferOutput<S>` | Output returned after parsing/transformation. |
| `SchemaPresence` | `"required" | "optional" | "defaulted"`. |
| `ParseOptions` | `abortEarly` and `maxIssues` controls. |
| `PathSegment` | A string object key or numeric array index. |
| `ValueKind` | Safe category used by `ValidationIssue.received`. |
| `ValidationIssue` | One structured validation failure. |
| `SafeParseSuccess<T>` | `{ success: true, data: T }`. |
| `SafeParseFailure` | `{ success: false, issues }`. |
| `SafeParseResult<T>` | Success/failure discriminated union. |
| `RefinementOptions` | Optional custom `code` and `message`. |
| `Shape` | Readonly mapping from object field names to schemas. |
| `UnknownKeyPolicy` | `"strip" | "strict" | "passthrough"`. |
| `ObjectSchema<Shape, Policy>` | Object schema plus composition/policy methods. |
| `ObjectInput<Shape>` | Input inferred from an object shape. |
| `ObjectOutput<Shape>` | Output inferred from an object shape. |
| `StandardSchemaV1<Input, Output>` | Kern's synchronous Standard Schema surface. |

Prefer inference over manually spelling these generics. They are most useful when authoring a
reusable function that accepts schemas rather than when defining ordinary application data.
