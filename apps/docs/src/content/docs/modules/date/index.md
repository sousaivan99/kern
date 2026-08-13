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

formatDate(release, { locale: "en-GB", timeZone: "UTC" })
isAfter(followUp, release) // true
toUTCISODate(release) // "2026-08-13"
```

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

The module remains scoped to native `Date`. Temporal is the future native path for richer date/time
modeling; Kern does not add a competing abstraction or bundled polyfill.

- [Arithmetic and boundaries](./arithmetic-and-boundaries/) explains local-calendar changes.
- [Formatting and comparison](./formatting-and-comparison/) explains all formatter options and
  instant-versus-calendar comparison.
