---
title: Validation collections
description: Validate arrays, tuples, objects, records, and unions with precise nested paths.
sidebar:
  order: 2
---

Collection schemas build larger contracts from smaller schemas. Nested validators share one issue
collector and preserve the exact path to each failure.

## Arrays

```ts
import { array, string } from "@kern/core/validation"

const Tags = array(string().trim().min(1))

console.log("Success:", Tags.safeParse([" typescript ", "kern"]))
console.log("Failure:", Tags.safeParse(["valid", ""])) // issue path: [1]
```

`array(elementSchema)` accepts only arrays and runs the element schema for every index until the
shared issue limit is reached. It returns a new array containing each parsed/transformed output.
Sparse positions are read as `undefined` and validated normally.

There are no built-in array length constraints. Use `.refine()` when the application needs one:

```ts
import { array, string } from "@kern/core/validation"

const NonEmptyTags = array(string()).refine((tags) => tags.length > 0, {
  code: "empty_tags",
  message: "Add at least one tag",
})

console.log("Success:", NonEmptyTags.safeParse(["kern"]))
console.log("Failure:", NonEmptyTags.safeParse([]))
```

## Tuples

```ts
import { number, string, tuple } from "@kern/core/validation"

const Coordinate = tuple([number().finite(), number().finite()] as const)
const Entry = tuple([string(), number().integer()] as const)

console.log("Coordinate success:", Coordinate.safeParse([49.61, 6.13]))
console.log("Coordinate failure:", Coordinate.safeParse([49.61]))
console.log("Entry success:", Entry.safeParse(["items", 3]))
console.log("Entry failure:", Entry.safeParse(["items", 3.5]))
```

`tuple(schemas)` requires an array with exactly the same length as the schema tuple. Each position
has its own inferred type. Use `as const` to preserve the tuple rather than widening it to a general
array.

An incorrect overall length produces `invalid_length` at the tuple path. Per-item failures use the
numeric index path.

## Object shapes

```ts
import { number, object, string } from "@kern/core/validation"

const User = object({
  id: number().integer(),
  name: string().trim().min(2),
  nickname: string().optional(),
  role: string().default("member"),
})

console.log("Success:", User.safeParse({ id: 1, name: " Ada " }))
console.log("Failure:", User.safeParse({ id: 1, name: "A" }))
```

`object(shape)` accepts plain objects and null-prototype objects. Arrays, dates, functions, and
class instances fail with `invalid_type`.

Field presence rules:

| Field schema | Missing key | Own key with `undefined` | Output field |
| --- | --- | --- | --- |
| `string()` | `required` issue | Validated and fails | Required |
| `string().optional()` | Accepted | Accepted | Omitted when output is `undefined` |
| `string().default("x")` | Accepted | Accepted | Required and contains default |
| `string().nullable()` | Still required | Fails | Required; value may be `null` |

Known fields are processed in shape declaration order. Unknown enumerable own string keys are
processed afterward when the selected policy needs them. This makes issue order deterministic.

## Unknown-key policies

```ts
import { object, string } from "@kern/core/validation"

const User = object({ name: string() })
const input = { name: "Ada", traceId: "abc" }

console.log("Strip success:", User.strip().safeParse(input))
console.log("Strict failure:", User.strict().safeParse(input))
console.log("Passthrough success:", User.passthrough().safeParse(input))
```

| Method | Unknown values | Inferred output |
| --- | --- | --- |
| `.strip()` | Removed; this is the default | Known fields only |
| `.strict()` | One `unrecognized_key` issue per key | Known fields only |
| `.passthrough()` | Retained without validating their values | Known fields plus `Record<string, unknown>` |

Only enumerable own string keys participate in unknown-key handling. Symbol and non-enumerable
unknown keys are not included in parsed output. Dangerous names such as `__proto__` are created as
safe own data properties rather than assigned through the legacy prototype setter.

## Compose object schemas

Object composition is immutable. Every method returns a new schema and leaves the source unchanged.

```ts
import { boolean, number, object, string } from "@kern/core/validation"

const User = object({
  id: number().integer(),
  name: string().min(2),
  password: string().min(12),
  role: string().default("member"),
}).strict()

const PublicUser = User.omit(["password"])
const UserSummary = User.pick(["id", "name"])
const UserPatch = User.partial()
const ActiveUser = PublicUser.extend({ active: boolean() })

console.log(UserSummary.parse({ id: 1, name: "Ada" }))
console.log(UserPatch.parse({ name: "Grace" }))
console.log(ActiveUser.parse({ id: 1, name: "Ada", role: "admin", active: true }))
console.log("Failure:", ActiveUser.safeParse({ id: 1, name: "A", active: true }))
```

| Method | Behavior |
| --- | --- |
| `.pick(keys)` | Keep only listed known fields. |
| `.omit(keys)` | Remove listed known fields. |
| `.partial()` | Make every field genuinely optional. |
| `.extend(shape)` | Add fields; new fields replace conflicting old fields. |

`pick` and `omit` accept only known keys at compile time. A runtime key outside the shape throws
`RangeError`, which also protects dynamic JavaScript callers.

`extend()` keeps existing field order for non-conflicts and replaces a conflicting schema with the
new definition. Composition preserves `.strip()`, `.strict()`, or `.passthrough()` policy.

### Defaults under `partial`

`partial()` wraps the complete original field from the outside:

```ts
import { object, string } from "@kern/core/validation"

const Settings = object({ theme: string().default("system") })
const SettingsPatch = Settings.partial()

Settings.parse({}) // { theme: "system" }
SettingsPatch.parse({}) // {}
SettingsPatch.parse({ theme: undefined }) // {}
```

This is important for PATCH/update payloads: a missing field means “leave it unchanged,” not “apply
the create-time default.”

General modifiers such as `.transform()` and `.optional()` may return the general `Schema`
interface, so object-only methods are not guaranteed after those modifiers. Compose the object
shape first, then apply a general transform.

## Records

```ts
import { number, record } from "@kern/core/validation"

const Scores = record(number().integer().min(0))

console.log("Success:", Scores.safeParse({ ada: 10, grace: 9 }))
console.log("Failure:", Scores.safeParse({ ada: 10, grace: -1 }))
```

`record(valueSchema)` validates every enumerable own string-keyed value in a plain or
null-prototype object. Keys themselves are not transformed or restricted. The result is a new plain
object. Use `object({...})` instead when keys are known and have different schemas.

## Unions

```ts
import { literal, object, string, union } from "@kern/core/validation"

const Contact = union([
  object({ type: literal("email"), value: string().email() }),
  object({ type: literal("phone"), value: string().min(7) }),
] as const)

console.log("Success:", Contact.safeParse({ type: "email", value: "ada@example.com" }))
console.log("Failure:", Contact.safeParse({ type: "email", value: "not-an-email" }))
```

`union(schemas)` requires at least two alternatives. Alternatives are tested independently in
input order. The first successful alternative supplies the output. Issues from failed alternatives
are discarded; if every alternative fails, Kern emits one `invalid_union` issue at the union path.

This keeps ordinary failures compact. If a UI must explain every branch, model a discriminating
field with an outer object or validate alternatives separately.

## Advanced: hostile property access

Object and record schemas read own properties during validation. If a getter throws, Kern catches
it and produces `validation_exception` at the exact property path. It never stores the thrown error
or rejected raw value in the issue.

```ts
import { object, string } from "@kern/core/validation"

const input = Object.defineProperty({}, "name", {
  enumerable: true,
  get() {
    throw new Error("secret internal failure")
  },
})

const result = object({ name: string() }).safeParse(input)
console.log("Normal success:", object({ name: string() }).safeParse({ name: "Ada" }))
console.log("Getter failure:", result)
```
