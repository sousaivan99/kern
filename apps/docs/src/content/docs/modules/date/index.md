---
title: Date
description: Choose the right local-calendar, instant, formatting-timezone, or UTC operation.
sidebar:
  order: 3
  label: Date overview
---

JavaScript `Date` stores one instant as milliseconds since the Unix epoch. Calendar fields such as
“day” and “month” are interpreted through a timezone. Kern makes that distinction visible instead
of pretending all date operations are the same.

## Start here: decide whether you mean an instant or a calendar day

An **instant** is one exact moment worldwide. A **calendar day** depends on a timezone. The same
instant may be Thursday in one place and Friday in another.

```ts
const instant = new Date("2026-08-14T00:30:00Z")

console.log(instant.getTime()) // one exact timestamp
console.log(instant.getFullYear()) // interpreted in the host-local timezone
console.log(instant.getUTCFullYear()) // interpreted in UTC
```

Use an ISO string with a `Z` or explicit offset for a known instant. Use numeric fields such as
`new Date(2026, 7, 14, 9, 30)` when you intentionally mean the host-local calendar and clock. Note
that JavaScript month numbers start at zero: `0` is January and `7` is August.

## Choose the correct kind of operation

| Kind | Kern helpers | Meaning |
| --- | --- | --- |
| Instant comparison | `isBefore`, `isAfter`, `isSameInstant` | Compare epoch milliseconds. |
| Local calendar | add/subtract, day boundaries, day comparisons | Use the host machine's timezone. |
| Display timezone | `formatDate`, `formatDateTime` | Use `options.timeZone` when supplied. |
| UTC calendar output | `toUTCISODate` | Return the UTC `YYYY-MM-DD`. |

```ts
import { addDays, formatDate, isAfter, toUTCISODate } from "@kern/core/date"

const release = new Date("2026-08-13T14:30:00Z")
const followUp = addDays(release, 7)

console.log(formatDate(release, { locale: "en-GB", timeZone: "UTC" })) // "13/08/2026"
console.log(isAfter(followUp, release)) // true
console.log(toUTCISODate(release)) // "2026-08-13"

addDays(new Date(Number.NaN), 1)
// RangeError: Expected a valid Date
```

The runnable console keeps the three successful results visible, then shows the exact invalid-date
error. Detailed pages repeat this success/error pattern for each fallible date helper.

## Shared rules

- Every helper that accepts a `Date` checks that it is a valid native `Date`.
- Invalid dates throw `RangeError`, except `isValidDate`, which returns `false`.
- Date arithmetic and boundaries return a new `Date`; they never mutate the supplied one.
- Kern does not parse date strings. Construct or validate the `Date` at your application boundary.
- `new Date("...")` parsing rules are native JavaScript rules and may be surprising for ambiguous
  strings; prefer ISO input or explicit numeric fields.

## What Kern deliberately does not do

Kern does not provide named-timezone arithmetic such as “add one business day in Europe/Paris,”
recurrence schedules, holiday calendars, or ambiguous wall-clock resolution. Use a dedicated
timezone/domain library when those rules are central to your application.

## Common beginner mistakes

- `new Date(2026, 8, 1)` is September 1, not August 1, because numeric months start at zero.
- A date-only ISO string and a numeric local date can describe different instants. Avoid ambiguous
  input strings and define the boundary format your application accepts.
- Adding a calendar day is not always adding exactly 24 hours because daylight-saving offsets can
  change.
- `formatDate()` returns display text. Do not store it as the canonical timestamp or parse it back.
- A server's host-local timezone may differ from a user's. Use an explicit formatting `timeZone`
  when the audience's zone is known.
- `toUTCISODate()` returns the UTC calendar date, which can differ from the user's local date.
- `Date` is mutable, but Kern returns new dates and leaves supplied dates unchanged.

## Advanced usage

### Make server output deterministic

Pass the locale and display timezone explicitly, and pass a stable `now` argument to relative-day
comparisons:

```ts
import { formatDateTime, isToday } from "@kern/core/date"

const now = new Date("2026-08-14T12:00:00Z")
const value = new Date("2026-08-14T09:30:00Z")

formatDateTime(value, {
  locale: "en-GB",
  timeZone: "Europe/Luxembourg",
})
isToday(value, now)
```

The formatting timezone is explicit; `isToday()` still uses the executing host's local calendar by
contract. For named-timezone calendar arithmetic, use a dedicated timezone/domain abstraction.

### Conditional Temporal internals

[Temporal is Stage 4](https://github.com/tc39/proposal-temporal) and has shipped in Firefox,
Chrome, and Node 26. Kern's Node 22/24 and Bun baselines still prevent universal reliance on it, so
the public module remains scoped to native `Date`. Calendar arithmetic and boundaries detect and
use a complete global Temporal implementation when available, with the existing `Date` behavior as
the fallback. Detection happens when a helper is called, so a polyfill installed after importing
Kern can still be used. No Temporal type or runtime dependency becomes part of the public API.

- [Arithmetic and boundaries](./arithmetic-and-boundaries/) explains local-calendar changes.
- [Formatting and comparison](./formatting-and-comparison/) explains all formatter options and
  instant-versus-calendar comparison.
