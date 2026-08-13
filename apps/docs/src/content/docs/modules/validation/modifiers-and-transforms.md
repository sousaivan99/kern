---
title: Validation modifiers and transforms
description: Model absence, nullability, defaults, transformations, refinements, and type guards.
sidebar:
  order: 3
---

Every schema supports the same composable modifiers.

```ts
import { number, object, string } from "@kern/core/validation"

const Configuration = object({
  nickname: string().optional(),
  middleName: string().nullable(),
  role: string().default("member"),
  port: string()
    .trim()
    .transform(Number)
    .refine((port) => Number.isInteger(port) && port >= 1 && port <= 65_535, {
      code: "invalid_port",
      message: "Expected a TCP port from 1 to 65535",
    }),
  positiveInteger: number().refine((value): value is number => Number.isInteger(value) && value > 0),
})

const value = Configuration.parse({
  middleName: null,
  port: " 3000 ",
  positiveInteger: 2,
})

console.log(value)
```

- `.optional()` accepts `undefined` and makes an object field optional.
- `.nullable()` accepts `null` without changing field-presence semantics.
- `.default(value)` replaces a successful `undefined` output and makes the output field required.
- `.transform(callback)` changes successful output while preserving the original input type.
- `.refine(predicate, issue?)` adds a custom constraint; a TypeScript type guard may narrow output.

Callback exceptions are converted into generic validation issues during `safeParse()` rather than
escaping. Modifier ordering is observable, so write the chain in the same order that input should
be processed. Defaults accept missing input but produce required output. `nullable()` does not
change whether an object key is required, and `partial()` wraps fields outside their defaults so
missing defaulted values remain absent.
