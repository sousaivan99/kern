---
title: Date arithmetic and boundaries
description: Add local-calendar units and create day boundaries without mutating dates.
sidebar:
  order: 1
---

All helpers on this page use the **host's local calendar** and return a new `Date`. They are not
fixed-duration arithmetic.

## Days

```ts
import { addDays, subtractDays } from "@kern/core/date"

const release = new Date(2026, 7, 13, 10, 30)
const reminder = subtractDays(release, 2)
const followUp = addDays(release, 7)

console.log(reminder, release, followUp)
```

`addDays(date, amount)` and `subtractDays(date, amount)` move through local calendar dates. Across a
daylight-saving transition, the elapsed duration can be 23 or 25 hours. That is correct for “same
local time on another calendar day.”

## Months

```ts
import { addMonths, subtractMonths } from "@kern/core/date"

const january31 = new Date(2024, 0, 31, 10)

addMonths(january31, 1) // local February 29, 2024 at 10:00
subtractMonths(january31, 1) // local December 31, 2023 at 10:00
```

Months have different lengths. Kern first moves to the destination month, then clamps the day to
that month's final valid day. For example, January 31 plus one month becomes February 28 or 29,
not a date in March.

Month arithmetic is not generally reversible after clamping: adding a month to January 31 and
subtracting a month from February 29 produces January 29.

## Years

```ts
import { addYears, subtractYears } from "@kern/core/date"

const leapDay = new Date(2024, 1, 29, 12)

addYears(leapDay, 1) // local February 28, 2025
subtractYears(leapDay, 4) // local February 29, 2020
```

Year operations use the same month-end clamping. A leap day becomes February 28 in a non-leap
year.

## Start and end of a day

```ts
import { endOfDay, startOfDay } from "@kern/core/date"

const value = new Date(2026, 7, 13, 14, 30, 15)

startOfDay(value) // local 00:00:00.000
endOfDay(value) // local 23:59:59.999
```

These boundaries use the host's local timezone. They are useful for local UI/calendar logic, but
querying a database with inclusive `endOfDay` can be harder to reason about than using an exclusive
start-of-next-day boundary.

## Parameters and errors

| Parameter | Requirement |
| --- | --- |
| `date` | A valid native `Date`. Invalid dates throw `RangeError`. |
| `amount` | A safe integer. Positive, zero, and negative amounts are accepted. |

Passing a negative amount reverses direction, so `addDays(date, -2)` is equivalent to
`subtractDays(date, 2)`. Fractional, infinite, `NaN`, and unsafe amounts throw `RangeError`.

None of these functions changes the supplied date:

```ts
import { addDays } from "@kern/core/date"

const original = new Date(2026, 0, 1)
const changed = addDays(original, 1)

console.log(original.getDate()) // 1
console.log(changed.getDate()) // 2
```
