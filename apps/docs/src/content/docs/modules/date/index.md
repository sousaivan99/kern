---
title: Date
description: Explicit local-calendar arithmetic, instant comparison, Intl formatting, and UTC output.
sidebar:
  order: 3
  label: Date overview
---

Kern date helpers validate supplied `Date` objects and never mutate them. Each operation states
whether it works with an instant, the host's local calendar, a requested formatting timezone, or UTC.

```ts
import { addDays, formatDate, isAfter, toUTCISODate } from "@kern/core/date"

const release = new Date("2026-08-13T14:30:00Z")
const followUp = addDays(release, 7)

console.log(formatDate(release, { locale: "en-GB", timeZone: "UTC" }))
console.log(isAfter(followUp, release))
console.log(toUTCISODate(release))
```

Kern does not attempt general timezone arithmetic. Use a dedicated timezone library when business
rules operate in named zones independently of the host environment. The module remains scoped to
native `Date`; Temporal is the future native path for richer date/time modeling, and Kern does not
add a competing abstraction or bundled polyfill.
