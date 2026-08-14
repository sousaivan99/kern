---
title: New to JavaScript or TypeScript?
description: Learn the small amount of JavaScript and TypeScript vocabulary needed to use Kern.
sidebar:
  order: 2
---

This page is for you if terms such as “function,” “argument,” “return value,” “object,” or
“promise” are still new. You do not need to memorize everything before using Kern. Read the first
program, learn how to read one helper call, and return to the later sections when a guide uses an
unfamiliar idea.

If Kern is not installed yet, follow [Installation](./installation/) first and then return here.

## Your first complete program

Create a file named `example.ts`:

```ts
import { unique } from "@kern/core/array"

const names = ["Ada", "Grace", "Ada"]
const distinctNames = unique(names)

console.log(distinctNames) // ["Ada", "Grace"]
console.log(names) // ["Ada", "Grace", "Ada"]
```

### How to run examples in these guides

Only examples that explicitly contain `console.log()` have a **Run example** button. Select it to
run the code and read its output in the console directly below the example. That console keeps a
fixed height, so running the code does not make the rest of the page jump.

Many fallible helpers deliberately show a correct input first and a wrong input last. Their console
keeps the successful result, adds **Thrown error**, and then shows the exact error name and message.
This lets you learn the normal and error paths together. Examples without `console.log()` do not
show a run control or invent output. Framework and network examples explain when they need the
complete application instead of pretending that they can run by themselves.

Read it from top to bottom:

1. `import` makes Kern's `unique` function available in this file.
2. `const names = ...` creates a variable containing an array. An array is an ordered list.
3. `unique(names)` **calls** the function and passes `names` as its **argument**.
4. The function **returns** a new array, which is stored in `distinctNames`.
5. `console.log()` prints values so you can inspect them.
6. The original `names` array did not change. Kern calls this non-mutating behavior.

Run the file with Bun:

```bash
bun example.ts
```

## How to read a function signature

A guide may show this signature:

```text
chunk(values, size): T[][]
```

It means:

- the function is named `chunk`;
- it expects two arguments named `values` and `size`;
- arguments are written between `(` and `)` and separated by commas;
- the `:` introduces the TypeScript return type;
- `T` means “whatever item type your input array contains”; and
- `[][]` means an array containing other arrays.

You call it with real values:

```ts
import { chunk } from "@kern/core/array"

const pages = chunk(["a", "b", "c", "d", "e"], 2)
console.log(pages) // [["a", "b"], ["c", "d"], ["e"]]
```

You normally do not write the generic `T` yourself. TypeScript works it out from the array.

## Values you will see

JavaScript programs work with several kinds of values:

```ts
const text = "hello" // string: text
const count = 3 // number
const enabled = true // boolean: true or false
const missing = undefined // no value was supplied
const empty = null // an intentional empty value
const names = ["Ada", "Grace"] // array: an ordered list
const user = { name: "Ada", active: true } // object: named properties
const createdAt = new Date() // Date: one instant in time
```

Kern does not silently convert one kind into another. For example, a validation `number()` schema
accepts `42` but rejects the string `"42"`.

## Objects and options

An object groups named values. Many Kern functions accept an optional final **options object**:

```ts
import { formatNumber } from "@kern/core/number"

const options = {
  locale: "en-US",
  maximumFractionDigits: 2,
}

const text = formatNumber(1234.567, options)
console.log(text) // commonly "1,234.57"
```

You may write the object directly inside the call:

```ts
import { formatNumber } from "@kern/core/number"

formatNumber(1234.567, { locale: "en-US", maximumFractionDigits: 2 })
```

A question mark in documentation, such as `options?`, means the argument is optional. Leaving it
out uses the documented defaults.

## Callbacks, predicates, and selectors

A **callback** is a function you give to another function. Kern calls it later or once per value.

An arrow function such as `(number) => number > 0` is a short way to write a callback:

```ts
import { partition } from "@kern/core/array"

const [positive, remaining] = partition(
  [-2, 0, 3, 7],
  (number) => number > 0,
)

console.log(positive) // [3, 7]
console.log(remaining) // [-2, 0]
```

The callback in this example is a **predicate** because it answers `true` or `false`. A
**selector** returns a key used to identify or group a value:

```ts
import { groupBy } from "@kern/core/array"

const words = ["cat", "apple", "car"]
const byFirstLetter = groupBy(words, (word) => word[0] ?? "")

console.log(byFirstLetter.c) // ["cat", "car"]
```

## Synchronous and asynchronous code

Most Kern functions return their answer immediately. They are **synchronous**:

```ts
import { addMoney } from "@kern/core/money"

const total = addMoney(100, 50) // total is available immediately
```

Time, network, and other delayed work is **asynchronous**. An asynchronous function returns a
`Promise`, which represents a value that may arrive later. Use `await` to wait for it:

```ts
import { sleep } from "@kern/core/async"

async function showMessage(): Promise<void> {
  console.log("Waiting...")
  await sleep(500)
  console.log("Finished")
}

await showMessage()
```

`await` can be used at the top level of a modern ESM file or inside a function marked `async`.

## Expected failures and thrown errors

Some failures are normal user input. Validation offers `safeParse()` so you can handle them without
an exception:

```ts
import { string } from "@kern/core/validation"

const Email = string().email()
const result = Email.safeParse("not an email")

if (result.success) {
  console.log(result.data)
} else {
  console.log(result.issues[0]?.message) // "Invalid email address"
}
```

Invalid programmer configuration throws an error. Use `try`/`catch` only when your program can
meaningfully recover:

```ts
import { chunk } from "@kern/core/array"

try {
  chunk([1, 2, 3], 0)
} catch (error) {
  console.error(error) // RangeError: the chunk size must be positive
}
```

Each helper guide says which kind of failure to expect.

## TypeScript types versus runtime checks

TypeScript checks your code while you develop. Its types do not remain in the running JavaScript.
That means data from JSON, a request, storage, or a form must still be checked at runtime.

```ts
import { object, string } from "@kern/core/validation"

const User = object({ name: string().min(1) })
const input: unknown = JSON.parse('{"name":"Ada"}')
const user = User.parse(input)

console.log(user.name) // TypeScript and the running program now agree
```

`unknown` means “this value exists, but it has not been checked yet.” It is safer than `any`, which
turns off useful TypeScript checks.

## Mutation and new values

To **mutate** a value means to change the existing value. Kern normally returns a new array, object,
or `Date` instead:

```ts
import { addDays } from "@kern/core/date"

const original = new Date(2026, 0, 1)
const tomorrow = addDays(original, 1)

console.log(original.getDate()) // 1
console.log(tomorrow.getDate()) // 2
```

This makes code easier to reason about because a helper does not unexpectedly change a value used
somewhere else. `deepFreeze()` is the documented exception: freezing the supplied graph is its
purpose.

## Units matter

Many bugs come from passing a value in the wrong unit:

| Area | Unit used by Kern | Example |
| --- | --- | --- |
| Async delays | Milliseconds | `sleep(1000)` waits about one second. |
| Money | Integer minor units | For two-decimal EUR, `1099` commonly means €10.99. |
| Percentages | Percentage points | `15` means 15%, not `0.15`. |
| Date arithmetic | Host-local calendar units | One calendar day may be 23, 24, or 25 hours. |

The module guide repeats the relevant unit beside every function that needs it.

## Beginner and advanced sections

Each module guide now has two levels:

- **Start here** explains the mental model and the safest common use.
- **Common mistakes** shows what beginners frequently pass incorrectly.
- **Advanced usage** covers precise TypeScript inference, security boundaries, locale data,
  rounding policy, cancellation, performance, and runtime edge cases.

You can ignore the advanced sections until your application needs them. The simple defaults remain
the same.

## Recommended reading order

1. Finish [Installation](./installation/).
2. Follow the [Quick start](./quick-start/) once without changing it.
3. Read [Core ideas](./core-ideas/) for Kern's shared rules.
4. Use [All helpers](../../modules/) to find one function for your current problem.
5. Open the [Glossary](../../concepts/glossary/) whenever a term is unfamiliar.
