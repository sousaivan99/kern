import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  startOfDay,
  toISODate,
} from "@kern/core/date"

export const runDateExamples = (): void => {
  console.log("\nDate")

  const release = new Date("2026-08-13T14:30:00Z")
  console.log("localized date", formatDate(release, { locale: "en-GB", timeZone: "UTC" }))
  console.log(
    "localized date and time",
    formatDateTime(release, {
      locale: "de-DE",
      timeZone: "Europe/Luxembourg",
      dateStyle: "medium",
      timeStyle: "short",
    }),
  )
  console.log("ISO date uses UTC", toISODate(release))

  const followUp = addDays(release, 7)
  console.log("follow-up", followUp.toISOString())
  console.log("days until follow-up", differenceInCalendarDays(followUp, release))
  console.log("follow-up is later (native)", followUp.getTime() > release.getTime())
  console.log(
    "relative",
    formatRelativeTime(followUp, release, { locale: "en", numeric: "always" }),
  )

  const january31 = new Date(2024, 0, 31, 10)
  console.log("month-end clamping", addMonths(january31, 1).toString())
  console.log("day boundaries", startOfDay(release).toISOString(), endOfDay(release).toISOString())
}

if (import.meta.main) runDateExamples()
