---
title: Validation collections
description: Compose object schemas and validate arrays, tuples, records, and unions with accurate paths.
sidebar:
  order: 2
---

## Object composition

Object schemas are immutable. Each method returns a new schema and leaves its source unchanged.

```ts
import { boolean, number, object, string } from "@kern/core/validation"

const User = object({
  id: number().integer(),
  name: string().min(2),
  password: string().min(12),
  role: string().default("member"),
})

const PublicUser = User.omit(["password"])
const UserSummary = User.pick(["id", "name"])
const UserPatch = User.partial()
const ActiveUser = PublicUser.extend({ active: boolean() })

console.log(UserSummary.parse({ id: 1, name: "Ada" }))
console.log(UserPatch.parse({ name: "Grace" }))
console.log(ActiveUser.parse({ id: 1, name: "Ada", role: "admin", active: true }))
```

`pick()` and `omit()` accept only known keys. `extend()` replaces conflicting fields with the new
schema. `partial()` makes every field genuinely optional; a missing field does not activate a
default inherited from the source schema. Composition preserves the current unknown-key policy.

## Unknown keys

```ts
import { object, string } from "@kern/core/validation"

const Base = object({ name: string() })

Base.strip().parse({ name: "Ada", traceId: "abc" })
Base.strict().safeParse({ name: "Ada", traceId: "abc" })
Base.passthrough().parse({ name: "Ada", traceId: "abc" })
```

`strip()` is the default. `strict()` emits one `unrecognized_key` issue at each unknown key path.
`passthrough()` retains enumerable own string-keyed values and infers an open
`Record<string, unknown>` alongside the known fields. Plain and null-prototype objects are accepted;
arrays and class instances are rejected. Dangerous keys such as `__proto__` are copied as safe own
data properties rather than assigned through the prototype setter.

## Arrays, tuples, records, and unions

```ts
import { array, literal, number, object, record, string, tuple, union } from "@kern/core/validation"

const Coordinates = tuple([number().finite(), number().finite()] as const)
const Metadata = record(string())
const Contact = union([
  object({ type: literal("email"), value: string().email() }),
  object({ type: literal("phone"), value: string().min(7) }),
] as const)
const Profile = object({ coordinates: Coordinates, tags: array(string()), metadata: Metadata, contact: Contact })

console.log(Profile.safeParse({
  coordinates: [49.61, 6.13],
  tags: ["engineer"],
  metadata: { team: "compiler" },
  contact: { type: "email", value: "ada@example.com" },
}))
```

Arrays and records validate every member until the shared issue limit is reached. Tuples require
an exact length. Union alternatives are tested independently, and a failed union produces one
`invalid_union` issue instead of leaking branch-specific failures.
