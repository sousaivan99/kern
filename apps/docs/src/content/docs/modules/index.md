---
title: All helpers
description: A complete map of every public Kern function and the guide that explains it.
sidebar:
  order: 1
---

This page is the quickest way to find a Kern function when you know what you want to do but do not
yet know which module owns it. Every public runtime helper is listed below. The linked guides give
copyable examples, parameter rules, return behavior, errors, and important edge cases.

## Choose your track

If you are completely new to JavaScript or TypeScript, begin with [New to JavaScript or
TypeScript?](../getting-started/from-zero/). It explains how to read function calls, arrays,
objects, callbacks, promises, options, errors, types, and units.

When a word is unfamiliar, open the [Glossary](../concepts/glossary/). Module pages keep the common
case first and label deeper type-system, security, locale, timezone, and policy material as
advanced. Experienced developers can jump straight to those advanced sections or the generated
API reference.

## How imports work

Prefer the smallest module subpath:

```ts
import { chunk } from "@kern/core/array"
import { addDays } from "@kern/core/date"
import { formatMoney } from "@kern/core/money"
```

The root package, `@kern/core`, re-exports the same helpers for convenience and adds no unique
function of its own. Subpath imports make ownership obvious and help bundlers include only what an
application uses.

## Validation

Validation turns untrusted `unknown` input into checked, typed output.

| Function or class | What it does | Detailed guide |
| --- | --- | --- |
| `string()` | Builds a non-coercive string schema with text constraints and transforms. | [Primitive schemas](./validation/primitives/) |
| `number()` | Builds a non-coercive number schema with range and numeric constraints. | [Primitive schemas](./validation/primitives/) |
| `boolean()` | Accepts only the actual values `true` and `false`. | [Primitive schemas](./validation/primitives/) |
| `date()` | Accepts valid native `Date` instances without parsing strings. | [Primitive schemas](./validation/primitives/) |
| `literal(value)` | Accepts one exact primitive value using `Object.is`. | [Primitive schemas](./validation/primitives/) |
| `enumeration(values)` | Accepts one string from a non-empty list. | [Primitive schemas](./validation/primitives/) |
| `array(schema)` | Validates every array item with one schema. | [Collection schemas](./validation/collections/) |
| `tuple(schemas)` | Validates a fixed-length array with a schema for each position. | [Collection schemas](./validation/collections/) |
| `object(shape)` | Validates a plain object's named properties. | [Collection schemas](./validation/collections/) |
| `record(schema)` | Validates arbitrary string-keyed values in a plain object. | [Collection schemas](./validation/collections/) |
| `union(schemas)` | Accepts the first matching schema alternative. | [Collection schemas](./validation/collections/) |
| `ValidationError` | Carries structured issues when `parse()` fails. | [Errors and inference](./validation/errors-and-inference/) |

Every schema also provides `parse`, `safeParse`, `optional`, `nullable`, `default`, `refine`, and
`transform`. Object schemas additionally provide `pick`, `omit`, `partial`, `extend`, `strip`,
`strict`, and `passthrough`. The [validation overview](./validation/) explains how these pieces fit
together before the focused guides teach each method.

## Money

Money helpers accept safe-integer **minor units** such as cents. They do not attach a currency to an
amount or perform exchange-rate conversion.

| Function | What it does | Detailed guide |
| --- | --- | --- |
| `currencyMinorUnitDigits` | Reads a currency's native fraction-digit metadata from `Intl`. | [Formatting and parsing](./money/formatting-and-parsing/) |
| `formatMoney` | Formats integer minor units as localized currency text. | [Formatting and parsing](./money/formatting-and-parsing/) |
| `parseMoney` | Strictly parses localized currency text into integer minor units. | [Formatting and parsing](./money/formatting-and-parsing/) |
| `addMoney` | Adds two checked minor-unit amounts. | [Money arithmetic](./money/arithmetic/) |
| `subtractMoney` | Subtracts one checked amount from another. | [Money arithmetic](./money/arithmetic/) |
| `sumMoney` | Adds an array of checked amounts and returns zero for an empty array. | [Money arithmetic](./money/arithmetic/) |
| `multiplyMoney` | Multiplies an amount and applies an explicit rounding rule. | [Money arithmetic](./money/arithmetic/) |
| `percentageOf` | Calculates a percentage of an amount. | [Money arithmetic](./money/arithmetic/) |
| `applyDiscount` | Subtracts a percentage discount from an amount. | [Money arithmetic](./money/arithmetic/) |
| `roundMoney` | Rounds an integer amount to a minor-unit increment. | [Money arithmetic](./money/arithmetic/) |
| `allocateMoney` | Splits an amount by integer weights while preserving the exact total. | [Money arithmetic](./money/arithmetic/) |

Read the [money overview](./money/) first if “minor units,” safe integers, or rounding modes are new
concepts.

## Date

Date helpers either compare exact instants, operate on the host-local calendar, format for a
display timezone, or return a UTC date string. The [date overview](./date/) explains this important
distinction.

| Function | What it does | Detailed guide |
| --- | --- | --- |
| `addDays`, `subtractDays` | Move by host-local calendar days. | [Arithmetic and boundaries](./date/arithmetic-and-boundaries/) |
| `addMonths`, `subtractMonths` | Move by local months and clamp invalid month-end dates. | [Arithmetic and boundaries](./date/arithmetic-and-boundaries/) |
| `addYears`, `subtractYears` | Move by local years and clamp leap days when needed. | [Arithmetic and boundaries](./date/arithmetic-and-boundaries/) |
| `startOfDay`, `endOfDay` | Return the first or final millisecond of a local day. | [Arithmetic and boundaries](./date/arithmetic-and-boundaries/) |
| `isValidDate` | Checks and narrows an unknown value to a valid native `Date`. | [Formatting and comparison](./date/formatting-and-comparison/) |
| `isBefore`, `isAfter`, `isSameInstant` | Compare epoch-millisecond instants. | [Formatting and comparison](./date/formatting-and-comparison/) |
| `differenceInCalendarDays` | Returns signed host-local calendar-day distance. | [Formatting and comparison](./date/formatting-and-comparison/) |
| `isSameDay` | Checks whether two dates share a host-local calendar day. | [Formatting and comparison](./date/formatting-and-comparison/) |
| `isToday`, `isTomorrow`, `isYesterday` | Compare a date with a supplied or current local day. | [Formatting and comparison](./date/formatting-and-comparison/) |
| `formatDate` | Formats date fields with native `Intl.DateTimeFormat`. | [Formatting and comparison](./date/formatting-and-comparison/) |
| `formatDateTime` | Formats date and time fields with native `Intl.DateTimeFormat`. | [Formatting and comparison](./date/formatting-and-comparison/) |
| `formatRelativeTime` | Describes one instant relative to another, such as “in 2 days.” | [Formatting and comparison](./date/formatting-and-comparison/) |
| `toUTCISODate` | Returns an instant's UTC date as `YYYY-MM-DD`. | [Formatting and comparison](./date/formatting-and-comparison/) |

## Number

| Function | What it does | Detailed guide |
| --- | --- | --- |
| `clamp` | Limits a number to inclusive lower and upper bounds. | [Number](./number/) |
| `round` | Rounds a number to positive or negative decimal precision. | [Number](./number/) |
| `isBetween` | Checks inclusive or exclusive ordered bounds. | [Number](./number/) |
| `percentageOfTotal` | Returns the percentage points represented by a part of a total. | [Number](./number/) |
| `formatNumber` | Formats a number with native locale rules. | [Number](./number/) |
| `formatCompact` | Produces compact locale text such as `1.2K`. | [Number](./number/) |
| `formatPercentage` | Formats percentage-point input such as `25` as `25%`. | [Number](./number/) |

## String

| Function | What it does | Detailed guide |
| --- | --- | --- |
| `capitalize`, `uncapitalize` | Changes only the first Unicode code point's case. | [String](./string/) |
| `camelCase` | Joins words as lower camel case. | [String](./string/) |
| `kebabCase` | Joins lowercase words with hyphens. | [String](./string/) |
| `snakeCase` | Joins lowercase words with underscores. | [String](./string/) |
| `slugify` | Produces a lowercase, diacritic-stripped kebab slug. | [String](./string/) |
| `truncate` | Shortens text by visible grapheme clusters without splitting emoji. | [String](./string/) |
| `isBlank` | Checks whether native trimming leaves an empty string. | [String](./string/) |

## Array

| Function | What it does | Detailed guide |
| --- | --- | --- |
| `first`, `last` | Reads an endpoint or returns `undefined` for an empty array. | [Array](./array/) |
| `unique` | Removes duplicate values using `Set` equality. | [Array](./array/) |
| `uniqueBy` | Keeps the first value for each selector result. | [Array](./array/) |
| `groupBy` | Collects values under calculated property keys. | [Array](./array/) |
| `partition` | Splits values into matches and non-matches. | [Array](./array/) |
| `chunk` | Copies values into fixed-size batches. | [Array](./array/) |
| `withoutFalsy` | Removes JavaScript-falsy values with useful type narrowing. | [Array](./array/) |

## Object

| Function | What it does | Detailed guide |
| --- | --- | --- |
| `hasOwn` | Checks one own key on an untrusted value. | [Object](./object/) |
| `hasOwnPath` | Traverses a safe path using own properties only. | [Object](./object/) |
| `pick` | Copies only selected own property descriptors. | [Object](./object/) |
| `omit` | Copies every own property descriptor except selected ones. | [Object](./object/) |
| `deepFreeze` | Recursively freezes a validated plain-data graph. | [Object](./object/) |

## Async

Async time values are always milliseconds.

| Function | What it does | Detailed guide |
| --- | --- | --- |
| `sleep` | Returns a promise that resolves after a cancellable delay. | [Async](./async/) |
| `retry` | Repeats a failed operation according to explicit limits and policy. | [Async](./async/) |
| `once` | Runs one callback once and replays its result or error. | [Async](./async/) |
| `debounce` | Waits for calls to stop, then runs the latest one. | [Async](./async/) |
| `throttle` | Runs immediately, then at most once per interval with a trailing call. | [Async](./async/) |

## Public type exports

Each module guide also explains its public TypeScript types next to the functions that use them:

- validation: schema, inference, parse result, issue, object-shape, and Standard Schema types;
- money: formatting, parsing, and exact rounding option types;
- date and number: native `Intl` option extensions;
- string: locale-aware case options;
- array: `NonFalsy<T>`;
- object: `ObjectPath` and `DeepReadonly<T>`;
- async: cancellation, retry, and scheduled-function contracts.

The generated **API reference** in the sidebar provides exact declaration signatures. Use these
module guides first for concepts and examples, then the generated reference when you need to check
a precise TypeScript type.
