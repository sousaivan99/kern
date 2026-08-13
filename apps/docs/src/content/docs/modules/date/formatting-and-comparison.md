---
title: Date formatting and comparison
description: Format with Intl and distinguish instant comparison from calendar-day comparison.
sidebar:
  order: 2
---

```ts
import { differenceInCalendarDays, formatDate, formatDateTime, formatRelativeTime, isAfter, isBefore, isSameDay, isSameInstant, isToday, isTomorrow, isValidDate, isYesterday, toUTCISODate } from "@kern/core/date"

const release = new Date("2026-08-13T14:30:00Z")
const followUp = new Date("2026-08-20T14:30:00Z")

console.log(formatDate(release, { locale: "en-GB", timeZone: "UTC" }))
console.log(formatDateTime(release, { locale: "de-DE", timeZone: "Europe/Luxembourg" }))
console.log(formatRelativeTime(followUp, release, { locale: "en", numeric: "always" }))
console.log(isBefore(release, followUp), isAfter(followUp, release))
console.log(isSameInstant(release, new Date(release.getTime())))
console.log(isSameDay(release, release), differenceInCalendarDays(followUp, release))
console.log(isToday(release), isTomorrow(release), isYesterday(release))
console.log(isValidDate(release), toUTCISODate(release))
```

`isBefore`, `isAfter`, `isSameInstant`, and relative-time formatting compare epoch milliseconds.
`isSameDay`, relative day checks, and `differenceInCalendarDays` use the host-local calendar.
Relative month and year selection uses average Gregorian durations and is approximate.

`formatDate` and `formatDateTime` delegate locale and named-timezone display to
`Intl.DateTimeFormat`. `toUTCISODate` is explicitly UTC and returns `YYYY-MM-DD`.
