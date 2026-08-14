---
title: Glossary
description: Plain-language definitions for the JavaScript, TypeScript, Intl, validation, and Kern terms used in these docs.
sidebar:
  order: 1
---

Use this page as a lookup table. You do not need to memorize it. Definitions favor plain language;
the advanced note adds precision when that matters.

## Everyday JavaScript

### Argument and parameter

A **parameter** is the name in a function's definition. An **argument** is the actual value passed
when calling it. In `chunk(values, size)`, `size` is a parameter; in `chunk(names, 2)`, `2` is the
argument.

### Array and tuple

An **array** is an ordered list such as `["Ada", "Grace"]`. A **tuple** is an array whose length and
position types are known, such as `[string, number]` for `["items", 3]`.

### Callback

A function passed to another function. `uniqueBy(users, (user) => user.id)` receives the callback
`(user) => user.id`.

### Function and helper

A **function** accepts arguments, performs work, and may return a value. The docs use **helper** for
a small function that makes a common operation safer or clearer.

### Object and property

An **object** groups values under keys: `{ name: "Ada", active: true }`. `name` and `active` are
properties. A property has a key and a value.

### `null` and `undefined`

`undefined` usually means a value was not supplied. `null` is commonly an intentional empty value.
Kern validation treats them separately: `.optional()` accepts `undefined`; `.nullable()` accepts
`null`.

### Return value

The result produced by a function. `unique([1, 1, 2])` returns `[1, 2]`.

### Throw, error, `RangeError`, and `TypeError`

To **throw** means stopping normal execution with an error. Kern generally uses `RangeError` when a
number or option is outside its allowed range, and `TypeError` when a value has an unsupported kind
or structure. Validation's `safeParse()` represents ordinary invalid input as data instead.

## TypeScript

### Compile time and runtime

**Compile time** is when TypeScript checks your source code. **Runtime** is when JavaScript actually
runs. TypeScript types disappear at runtime, so untrusted external data still needs validation.

### Discriminated union

A union whose members can be distinguished by one property. `SafeParseResult` uses `success`:
`true` means `data` exists; `false` means `issues` exists.

### Generic type

A reusable type with a placeholder. `Array<T>` means “an array of `T`.” TypeScript normally infers
Kern's generic types from the supplied values, so callers rarely write them explicitly.

### Inference

TypeScript working out a type from code. If a schema transforms a string to a number, Kern lets
TypeScript infer that the parsed output is a number.

### Narrowing and type guard

**Narrowing** changes a broad type into a more precise one after a check. A **type guard** is a
function whose TypeScript return type communicates that check. `isValidDate(value)` narrows a
successful `unknown` value to `Date`.

### `readonly`

A TypeScript promise that code should not assign to a property or mutate an array through that
reference. It is a compile-time restriction. `deepFreeze()` additionally freezes supported values
at runtime.

### `unknown` and `any`

`unknown` means a value has not been checked; TypeScript requires a check before you use it. `any`
turns off most checking. Kern uses `unknown` at untrusted boundaries.

## Data and object safety

### Own and inherited property

An **own property** belongs directly to an object. An **inherited property** comes from its
prototype. Kern's safe object helpers deliberately inspect own properties.

### Plain object

An ordinary `{}`-style object used for data, rather than a `Date`, array, function, class instance,
`Map`, or another built-in with special behavior.

### Property descriptor

Metadata describing a property: its value or getter/setter and whether it is enumerable, writable,
or configurable. `pick()` and `omit()` copy descriptors so these characteristics are preserved.

### Prototype and prototype pollution

JavaScript objects may inherit behavior through a **prototype**. **Prototype pollution** is a class
of security bug where attacker-controlled keys change shared prototypes. Kern rejects dangerous
path segments and creates dangerous names as safe own data where documented.

### Null-prototype object

An object created with `Object.create(null)`. It has no inherited object methods. `groupBy()` uses
one so keys such as `"constructor"` remain ordinary data. Inspect it with `Object.hasOwn()` rather
than calling `result.hasOwnProperty()`.

### Mutation and immutability

**Mutation** changes an existing value. **Immutable** operations return a new value instead. Kern
avoids mutating caller-owned data unless the helper explicitly says otherwise.

## Numbers and money

### Finite number, infinity, and `NaN`

A **finite** number is neither positive/negative infinity nor `NaN`. `NaN` means “not a number,” but
its JavaScript type is still `number`. Kern documents whether each helper accepts these special
values.

### Safe integer

An integer JavaScript can represent exactly, between `Number.MIN_SAFE_INTEGER` and
`Number.MAX_SAFE_INTEGER`. Money amounts and size/count configuration use safe integers where
exactness matters.

### Major and minor currency units

A **major unit** is commonly one dollar/euro/etc. A **minor unit** is commonly one cent. Kern money
helpers receive integer minor units: for a two-decimal currency, `1099` commonly represents 10.99
major units. Currency/provider rules can differ.

### Rounding increment and rounding mode

The **increment** is the step to which a value is rounded, such as 5 minor units. The **mode** says
which direction to choose, especially at an exact halfway tie. Your application owns the business
or legal policy; Kern performs the selected calculation.

## Text and internationalization

### Grapheme cluster

Roughly one user-perceived character. A family emoji or a letter plus a combining accent may use
several Unicode code points but form one grapheme. `truncate()` counts graphemes so it does not
split these sequences.

### `Intl`

JavaScript's built-in internationalization APIs. Kern delegates number, money, date, and relative
time display to `Intl`, so results follow the runtime's locale data.

### Locale

A language/region preference such as `"en-US"` or `"de-DE"`. It affects punctuation, digits,
wording, and casing conventions. It does not translate arbitrary application text.

### Unicode

The standard JavaScript uses to represent text from many writing systems and emoji. Visual
characters do not always correspond one-to-one with `string.length` positions.

## Dates and time

### Calendar date, instant, and epoch milliseconds

An **instant** is one exact point in time. JavaScript `Date` stores an instant as milliseconds since
the Unix epoch. A **calendar date** such as August 14 depends on the timezone used to view that
instant.

### DST

Daylight-saving time changes a timezone's offset. A local calendar day can therefore be shorter or
longer than 24 hours. Kern's calendar helpers preserve calendar meaning instead of assuming a fixed
duration.

### Host-local timezone

The default timezone of the browser, server, or runtime executing the code. Kern's calendar
arithmetic uses it. It may differ between a developer laptop and production server.

### Timezone and UTC

A **timezone** maps instants to local calendar/clock fields and can include historical offset
changes. **UTC** is the common zero-offset reference. Formatting may accept a named `timeZone`;
`toUTCISODate()` explicitly uses UTC.

## Validation

### Issue and path

An **issue** describes one validation failure. Its **path** locates the failure, such as
`["users", 0, "email"]` for the email of the first user.

### Predicate, refinement, and transform

A **predicate** returns `true` or `false`. A **refinement** uses one to add a custom validation rule.
A **transform** converts successful output, such as trimming text or converting a validated string
to a number.

### Schema

A value describing what runtime input is accepted and what output is produced. Kern schemas expose
`parse()`, `safeParse()`, modifiers, inference, and Standard Schema compatibility.

### Standard Schema

A shared interface that lets validation-aware tools accept schemas from different libraries.
Every Kern schema implements Standard Schema V1 through its `~standard` property.

## Packaging and execution

### Dependency

Another package that code needs. Kern has no runtime dependencies; an application only loads the
Kern code it imports plus native platform APIs.

### ESM and import

ESM is modern JavaScript's module system. `import { unique } from "@kern/core/array"` loads a named
export. Kern does not support CommonJS `require()`.

### Tree-shaking

A bundler optimization that removes unused exports from an application bundle. Kern's module
subpaths and side-effect-free functions are designed to support it.

### Promise, `async`, and `await`

A `Promise` represents an asynchronous result. An `async` function returns a promise. `await`
pauses that function until the promise settles, without blocking the entire JavaScript runtime.

### Cancellation and `AbortSignal`

An `AbortSignal` communicates that work should stop. Create one with `AbortController`, pass its
`signal` to supported Kern helpers, and call `controller.abort()` when the work is no longer needed.

