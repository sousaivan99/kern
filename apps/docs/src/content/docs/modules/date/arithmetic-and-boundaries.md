---
title: Date arithmetic and boundaries
description: Work with local-calendar days, months, years, and day boundaries without mutation.
sidebar:
  order: 1
---

```ts
import { addDays, addMonths, addYears, endOfDay, startOfDay, subtractDays, subtractMonths, subtractYears } from "@kern/core/date"

const january31 = new Date(2024, 0, 31, 10)
const nextMonth = addMonths(january31, 1)

console.log(addDays(january31, 7), subtractDays(january31, 7))
console.log(nextMonth, subtractMonths(nextMonth, 1))
console.log(addYears(january31, 1), subtractYears(january31, 1))
console.log(startOfDay(january31), endOfDay(january31))
```

All these functions use the host's local calendar. Day arithmetic follows local daylight-saving
transitions instead of assuming 24-hour durations. Month operations clamp to the final valid day
of the destination month; year operations similarly clamp leap-day inputs. Boundaries return a new
date at local `00:00:00.000` or `23:59:59.999`.
