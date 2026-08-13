import {
  calculatePercentage,
  clamp,
  formatCompact,
  formatPercent,
  isBetween,
  round,
} from "@kern/core/number"

export const runNumberExamples = (): void => {
  console.log("\nNumber")
  console.log("clamped volume", clamp(130, 0, 100))
  console.log("rounded measurement", round(12.3456, 2))
  console.log("inside range", isBetween(18, 13, 19))
  console.log("completion percentage points", calculatePercentage(42, 50))
  console.log("localized (native)", new Intl.NumberFormat("de-DE").format(1_234_567.89))
  console.log("compact", formatCompact(1_250_000, { locale: "en-US" }))
  console.log("ratio as percent", formatPercent(0.875, { locale: "en-US" }))
}

if (import.meta.main) runNumberExamples()
