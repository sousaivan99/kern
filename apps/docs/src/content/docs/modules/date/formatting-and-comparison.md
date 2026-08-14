---
title: Date formatting and comparison
description: Format with Intl and distinguish exact instants from local calendar days.
sidebar:
  order: 2
---

## Validate a date

```ts
import { isValidDate } from "@kern/core/date"

console.log("Valid date:", isValidDate(new Date())) // true
console.log("Invalid date:", isValidDate(new Date(Number.NaN))) // false
console.log("String is not a Date:", isValidDate("2026-08-13")) // false
```

`isValidDate(value)` accepts `unknown` and narrows successful values to `Date`. It requires a native
`Date` instance with a valid timestamp; it does not parse strings.

## `isBefore(left, right)`

```ts
import { isBefore } from "@kern/core/date"

const left = new Date("2026-08-13T14:30:00Z")
const right = new Date("2026-08-13T15:30:00Z")

console.log("Success:", isBefore(left, right)) // true

isBefore(new Date(Number.NaN), right)
// RangeError: Expected a valid Date
```

`isBefore()` returns `true` only when `left` is an earlier instant than `right`. Equal instants
return `false`.

## `isAfter(left, right)`

```ts
import { isAfter } from "@kern/core/date"

const release = new Date("2026-08-13T14:30:00Z")
const deployment = new Date("2026-08-13T15:30:00Z")

console.log("Later:", isAfter(deployment, release)) // true
console.log("Equal:", isAfter(release, release)) // false

isAfter(new Date(Number.NaN), release)
// RangeError: Expected a valid Date
```

`isAfter()` returns `true` only when `left` is a later instant than `right`.

## `isSameInstant(left, right)`

```ts
import { isSameInstant } from "@kern/core/date"

const left = new Date("2026-08-13T14:30:00Z")
const right = new Date(left.getTime())

console.log("Success:", isSameInstant(left, right)) // true

isSameInstant(left, new Date(Number.NaN))
// RangeError: Expected a valid Date
```

These three instant helpers compare epoch milliseconds. Different displayed timezones do not
change an instant. They validate both dates and throw `RangeError` for an invalid one.

## `differenceInCalendarDays(left, right)`

```ts
import { differenceInCalendarDays } from "@kern/core/date"

const now = new Date(2026, 7, 13, 23, 30)
const next = new Date(2026, 7, 14, 0, 15)

console.log("Success:", differenceInCalendarDays(next, now)) // 1

differenceInCalendarDays(new Date(Number.NaN), now)
// RangeError: Expected a valid Date
```

`differenceInCalendarDays(left, right)` returns `left - right` in host-local calendar days and
ignores time-of-day and daylight-saving duration. Swapping the arguments changes the sign.

## `isSameDay(left, right)`

```ts
import { isSameDay } from "@kern/core/date"

const morning = new Date(2026, 7, 13, 9)
const evening = new Date(2026, 7, 13, 21)

console.log("Success:", isSameDay(morning, evening)) // true in the host timezone

isSameDay(morning, new Date(Number.NaN))
// RangeError: Expected a valid Date
```

`isSameDay()` compares the host-local year, month, and date. It ignores the time of day.

## `isToday(date, now?)`

```ts
import { isToday } from "@kern/core/date"

const now = new Date(2026, 7, 13, 12)
console.log("Success:", isToday(new Date(2026, 7, 13, 8), now)) // true

isToday(new Date(Number.NaN), now)
// RangeError: Expected a valid Date
```

## `isTomorrow(date, now?)`

```ts
import { isTomorrow } from "@kern/core/date"

const now = new Date(2026, 7, 13, 12)
console.log("Success:", isTomorrow(new Date(2026, 7, 14, 8), now)) // true

isTomorrow(new Date(Number.NaN), now)
// RangeError: Expected a valid Date
```

## `isYesterday(date, now?)`

```ts
import { isYesterday } from "@kern/core/date"

const now = new Date(2026, 7, 13, 12)
console.log("Success:", isYesterday(new Date(2026, 7, 12, 20), now)) // true

isYesterday(new Date(Number.NaN), now)
// RangeError: Expected a valid Date
```

`isToday`, `isTomorrow`, and `isYesterday` default their second `now` argument to `new Date()`.
Pass it explicitly in tests, server requests, and batch jobs to keep all comparisons anchored to
the same instant.

## `formatDate(date, options?)`

```ts
import { formatDate } from "@kern/core/date"

const release = new Date("2026-08-13T14:30:00Z")

console.log("Success:", formatDate(release, { locale: "en-GB", timeZone: "UTC" }))

formatDate(new Date(Number.NaN), { locale: "en-GB", timeZone: "UTC" })
// RangeError: Expected a valid Date
```

With no formatting fields, `formatDate()` defaults to numeric day, short month, and numeric year.

## `formatDateTime(date, options?)`

```ts
import { formatDateTime } from "@kern/core/date"

const release = new Date("2026-08-13T14:30:00Z")

console.log("Success:", formatDateTime(release, {
  locale: "de-DE",
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Luxembourg",
}))

formatDateTime(new Date(Number.NaN), { locale: "de-DE" })
// RangeError: Expected a valid Date
```

`formatDateTime` defaults to `dateStyle: "medium"` and `timeStyle: "short"`. Supplying any native
formatting field replaces that complete default set.

`DateFormatOptions` adds `locale` beside all native `Intl.DateTimeFormatOptions`:

| Category | Options |
| --- | --- |
| Locale selection | `locale`, `localeMatcher`, `calendar`, `numberingSystem`, `hourCycle`, `hour12` |
| Timezone | `timeZone`, `timeZoneName` |
| Date fields | `weekday`, `era`, `year`, `month`, `day` |
| Time fields | `dayPeriod`, `hour`, `minute`, `second`, `fractionalSecondDigits` |
| Presets/matching | `dateStyle`, `timeStyle`, `formatMatcher` |

Valid option values and compatible combinations are defined by native `Intl`. For example,
`dateStyle`/`timeStyle` cannot be mixed with individual date/time component fields. Native invalid
locales, timezones, currencies, or combinations may throw `RangeError` or `TypeError`.

When `locale` or `timeZone` is omitted, runtime defaults are used. Pass both explicitly when output
must be reproducible across machines.

## Format relative time

```ts
import { formatRelativeTime } from "@kern/core/date"

const base = new Date("2026-08-13T12:00:00Z")
const later = new Date("2026-08-15T12:00:00Z")

console.log(formatRelativeTime(later, base, { locale: "en", numeric: "always" })) // "in 2 days"
console.log(formatRelativeTime(base, later, { locale: "en", numeric: "auto" })) // "2 days ago"

formatRelativeTime(new Date(Number.NaN), base, { locale: "en" })
// RangeError: Expected a valid Date
```

The signature is `formatRelativeTime(date, baseDate = new Date(), options = {})`. Kern chooses the
largest suitable unit from year down to second, rounds to a whole unit, and delegates wording to
`Intl.RelativeTimeFormat`.

`RelativeFormatOptions` supports:

| Option | Common values | Default |
| --- | --- | --- |
| `locale` | `"en"`, `"de-DE"`, locale arrays | Runtime locale |
| `localeMatcher` | `"lookup"`, `"best fit"` | Native default |
| `numeric` | `"always"`, `"auto"` | Native default (`"always"`) |
| `style` | `"long"`, `"short"`, `"narrow"` | Native default (`"long"`) |
| `numberingSystem` | A supported numbering system | Locale default |

Second, minute, hour, and day selection use fixed durations. Month and year selection uses average
Gregorian durations and is approximate; do not use the result for billing or exact calendar math.

## Return a UTC ISO date

```ts
import { toUTCISODate } from "@kern/core/date"

console.log(toUTCISODate(new Date("2026-08-13T23:30:00-05:00"))) // "2026-08-14"

toUTCISODate(new Date(Number.NaN))
// RangeError: Expected a valid Date
```

`toUTCISODate(date)` returns the instant's UTC calendar date as `YYYY-MM-DD`. It may differ from the
date shown in the user's local timezone. Invalid dates throw `RangeError`.

The runnable snippets print a normal result before the invalid-date call. The console then shows
the exact exception, without removing the successful line, so a beginner can see both paths in one
place.
