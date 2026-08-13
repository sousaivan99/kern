---
title: Validation errors and inference
description: Control issue collection, inspect safe metadata, reuse inferred types, and interoperate through Standard Schema.
sidebar:
  order: 4
---

## Structured issues

```ts
import { array, number, object, string } from "@kern/core/validation"

const Users = array(object({ email: string().email(), age: number().min(18) }))
const result = Users.safeParse([{ email: "invalid", age: 12 }])

if (!result.success) {
  for (const issue of result.issues) {
    console.log(issue.path, issue.code, issue.message)
    console.log(issue.expected, issue.received, issue.details)
  }
}
```

Every issue has a stable string `code`, a human-readable `message`, and a `path` of string/number
segments. Optional `expected`, `received`, and primitive-only `details` metadata helps build UIs
without retaining rejected values. `received` distinguishes values such as `null`, arrays, dates,
and `NaN`. Callback exceptions and hostile getters are never attached to an issue.

## Limits and thrown parsing

```ts
import { array, object, string } from "@kern/core/validation"

const Users = array(object({ email: string().email() }))
const first = Users.safeParse([], { abortEarly: true })
const bounded = Users.safeParse([], { maxIssues: 5 })

try {
  Users.parse("not an array")
} catch (error) {
  if (error instanceof Error && "issues" in error) console.log(error.issues)
}

console.log(first, bounded)
```

Validation aggregates issues by default. `abortEarly: true` makes the effective issue limit one;
`maxIssues` must be a positive safe integer. Invalid controls are programmer errors and throw
`RangeError`, including from `safeParse()`. Ordinary validation failure never makes `safeParse()`
throw. `parse()` throws `ValidationError`, whose structured failures are available as `.issues`.

## Input and output inference

```ts
import { type Infer, type InferInput, type InferOutput, string } from "@kern/core/validation"

const Port = string().trim().transform(Number)
type PortInput = InferInput<typeof Port>
type PortOutput = InferOutput<typeof Port>
type PortAlias = Infer<typeof Port>

const input: PortInput = "3000"
const output: PortOutput = Port.parse(input)
const sameOutput: PortAlias = output
console.log(sameOutput)
```

`InferOutput` follows transforms and defaults. `InferInput` preserves what the schema accepts
before parsing. `Infer` is the short output alias.

## Standard Schema V1

Every Kern schema exposes synchronous Standard Schema V1 properties through `~standard` with
vendor `kern`. This lets Standard Schema-aware form, RPC, and validation tools consume a Kern
schema without an adapter or dependency. Kern issue paths are passed through unchanged.

```ts
import { array, number, object, string } from "@kern/core/validation"

const Users = array(object({ email: string().email(), age: number().min(18) }))
const standardResult = Users["~standard"].validate([{ email: "ada@example.com", age: 36 }])
console.log(Users["~standard"].vendor, standardResult)
```
