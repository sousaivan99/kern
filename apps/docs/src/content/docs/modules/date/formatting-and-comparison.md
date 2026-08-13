---
title: Date formatting and comparison
description: Format with Intl and distinguish exact instants from local calendar days.
sidebar:
  order: 2
---

## Validate a date

```ts
import { isValidDate } from "@kern/core/date"

isValidDate(new Date()) // true
isValidDate(new Date(Number.NaN)) // false
isValidDate("2026-08-13") // false
```

`isValidDate(value)` accepts `unknown` and narrows successful values to `Date`. It requires a native
`Date` instance with a valid timestamp; it does not parse strings.

## Compare exact instants

```ts
import { isAfter, isBefore, isSameInstant } from "@kern/core/date"

const left = new Date("2026-08-13T14:30:00Z")
const right = new Date("2026-08-13T15:30:00Z")

isBefore(left, right) // true
isAfter(right, left) // true
isSameInstant(left, new Date(left.getTime())) // true
```

These helpers compare epoch milliseconds. Different displayed timezones do not change an instant.
They validate both dates and throw `RangeError` for an invalid one.

## Compare local calendar days

```ts
import {
  differenceInCalendarDays,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
} from "@kern/core/date"

const now = new Date(2026, 7, 13, 23, 30)
const next = new Date(2026, 7, 14, 0, 15)

differenceInCalendarDays(next, now) // 1
isSameDay(next, now) // false
isTomorrow(next, now) // true
isYesterday(now, next) // true
isToday(now, now) // true
```

`differenceInCalendarDays(left, right)` returns `left - right` in host-local calendar days and
ignores time-of-day and daylight-saving duration. The other helpers build on that behavior.

`isToday`, `isTomorrow`, and `isYesterday` default their second `now` argument to `new Date()`.
Pass it explicitly in tests, server requests, and batch jobs to keep all comparisons anchored to
the same instant.

## Format a date or date-time

```ts
import { formatDate, formatDateTime } from "@kern/core/date"

const release = new Date("2026-08-13T14:30:00Z")

formatDate(release, { locale: "en-GB", timeZone: "UTC" })
formatDateTime(release, {
  locale: "de-DE",
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Luxembourg",
})
```

With no formatting fields, `formatDate` defaults to numeric day, short month, and numeric year.
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

formatRelativeTime(later, base, { locale: "en", numeric: "always" }) // "in 2 days"
formatRelativeTime(base, later, { locale: "en", numeric: "auto" }) // "2 days ago"
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

toUTCISODate(new Date("2026-08-13T23:30:00-05:00")) // "2026-08-14"
```

`toUTCISODate(date)` returns the instant's UTC calendar date as `YYYY-MM-DD`. It may differ from the
date shown in the user's local timezone. Invalid dates throw `RangeError`.
