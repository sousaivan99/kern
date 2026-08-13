---
title: Validation
description: Inference-first runtime schemas with composition, safe defaults, and structured failures.
sidebar:
  order: 1
  label: Validation overview
---

```ts
import { enumeration, number, object, string } from "@kern/core/validation"

const User = object({
  name: string().trim().min(2),
  email: string().trim().email(),
  age: number().integer().min(18).optional(),
  role: enumeration(["member", "admin"] as const).default("member"),
})

const user = User.parse({ name: " Grace Hopper ", email: "grace@example.com" })
console.log(user.name, user.role)
```

The schema is both the runtime validator and the source of its TypeScript input/output types.
Most code can use the inferred return value directly. Use `Infer`, `InferInput`, or `InferOutput`
only when a reusable named type is genuinely useful.

Schemas never coerce unless an explicit transform does so. `safeParse()` returns a discriminated
result and aggregates ordinary validation issues by default. `parse()` returns the same inferred
output or throws `ValidationError`.

- [Primitive schemas](./primitives/) cover strings, numbers, booleans, dates, literals, and enums.
- [Collection schemas](./collections/) covers object composition and unknown-key policies.
- [Modifiers and transforms](./modifiers-and-transforms/) covers precise input/output changes.
- [Errors and inference](./errors-and-inference/) covers issue controls, metadata, and Standard Schema.
