---
title: Date arithmetic and boundaries
description: Add local-calendar units and create day boundaries without mutating dates.
sidebar:
  order: 1
---

All helpers on this page use the **host's local calendar** and return a new `Date`. They are not
fixed-duration arithmetic.

## `addDays(date, amount)`

```ts
import { addDays } from "@sousaivan/kern/date"

const release = new Date(2026, 7, 13, 10, 30)
const followUp = addDays(release, 7)

console.log(followUp) // local August 20, 2026 at 10:30

addDays(new Date(Number.NaN), 1)
// RangeError: Expected a valid Date
```

`addDays()` moves through local calendar dates. Across a
daylight-saving transition, the elapsed duration can be 23 or 25 hours. That is correct for “same
local time on another calendar day.”

## `subtractDays(date, amount)`

```ts
import { subtractDays } from "@sousaivan/kern/date"

const release = new Date(2026, 7, 13, 10, 30)
const reminder = subtractDays(release, 2)

console.log(reminder) // local August 11, 2026 at 10:30

subtractDays(release, 1.5)
// RangeError: Date amounts must be safe integers
```

`subtractDays()` is the readable reverse operation. It follows the same host-local calendar and
DST rules as `addDays()`.

## `addMonths(date, amount)`

```ts
import { addMonths } from "@sousaivan/kern/date"

const january31 = new Date(2024, 0, 31, 10)

console.log(addMonths(january31, 1)) // local February 29, 2024 at 10:00

addMonths(january31, Number.POSITIVE_INFINITY)
// RangeError: Date amounts must be safe integers
```

Months have different lengths. Kern first moves to the destination month, then clamps the day to
that month's final valid day. For example, January 31 plus one month becomes February 28 or 29,
not a date in March.

Month arithmetic is not generally reversible after clamping: adding a month to January 31 and
subtracting a month from February 29 produces January 29.

## `subtractMonths(date, amount)`

```ts
import { subtractMonths } from "@sousaivan/kern/date"

const january31 = new Date(2024, 0, 31, 10)

console.log(subtractMonths(january31, 1)) // local December 31, 2023 at 10:00

subtractMonths(new Date(Number.NaN), 1)
// RangeError: Expected a valid Date
```

`subtractMonths()` moves backward by whole local-calendar months and applies the same last-day
clamping as `addMonths()`.

## `addYears(date, amount)`

```ts
import { addYears } from "@sousaivan/kern/date"

const leapDay = new Date(2024, 1, 29, 12)

console.log(addYears(leapDay, 1)) // local February 28, 2025

addYears(leapDay, 0.5)
// RangeError: Date amounts must be safe integers
```

Year operations use the same month-end clamping. A leap day becomes February 28 in a non-leap
year.

## `subtractYears(date, amount)`

```ts
import { subtractYears } from "@sousaivan/kern/date"

const leapDay = new Date(2024, 1, 29, 12)

console.log(subtractYears(leapDay, 4)) // local February 29, 2020 at 12:00

subtractYears(new Date(Number.NaN), 4)
// RangeError: Expected a valid Date
```

`subtractYears()` moves backward by local-calendar years and preserves the local time when that
wall-clock time exists.

## `startOfDay(date)`

```ts
import { startOfDay } from "@sousaivan/kern/date"

const value = new Date(2026, 7, 13, 14, 30, 15)

console.log(startOfDay(value)) // local 00:00:00.000

startOfDay(new Date(Number.NaN))
// RangeError: Expected a valid Date
```

`startOfDay()` returns the first representable instant of the same host-local calendar date.

## `endOfDay(date)`

```ts
import { endOfDay } from "@sousaivan/kern/date"

const value = new Date(2026, 7, 13, 14, 30, 15)

console.log(endOfDay(value)) // local 23:59:59.999

endOfDay(new Date(Number.NaN))
// RangeError: Expected a valid Date
```

`endOfDay()` returns one millisecond before the next local day's start. These boundaries use the
host's local timezone. They are useful for local UI/calendar logic, but querying a database with
an inclusive end can be harder to reason about than using an exclusive start-of-next-day boundary.

## Parameters and errors

| Parameter | Requirement |
| --- | --- |
| `date` | A valid native `Date`. Invalid dates throw `RangeError`. |
| `amount` | A safe integer. Positive, zero, and negative amounts are accepted. |

Passing a negative amount reverses direction, so `addDays(date, -2)` is equivalent to
`subtractDays(date, 2)`. Fractional, infinite, `NaN`, and unsafe amounts throw `RangeError`.

None of these functions changes the supplied date:

```ts
import { addDays } from "@sousaivan/kern/date"

const original = new Date(2026, 0, 1)
const changed = addDays(original, 1)

console.log(original.getDate()) // 1
console.log(changed.getDate()) // 2
```

Each helper example prints its successful result first and then deliberately supplies one invalid
date or amount. Select **Run** to see the exact `RangeError` after the successful line. In an
application, validate unknown input before constructing a date and catch errors at the boundary
where recovery is possible.
