export {}

const benchmark = process.argv[2]
const start = performance.now()

if (benchmark === "number") {
  const { formatNumber } = await import("../../packages/kern/src/number/index.js")
  formatNumber(1_234_567.89, { locale: "de-DE", maximumFractionDigits: 2 })
} else if (benchmark === "date") {
  const { formatDate } = await import("../../packages/kern/src/date/index.js")
  formatDate(new Date("2025-01-02T12:00:00Z"), {
    day: "numeric",
    locale: "en-US",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  })
} else if (benchmark === "money-format") {
  const { formatMoney } = await import("../../packages/kern/src/money/index.js")
  formatMoney(1099, "EUR", { locale: "de-DE" })
} else if (benchmark === "money-parse") {
  const { parseMoney } = await import("../../packages/kern/src/money/index.js")
  parseMoney("10,99 €", "EUR", { locale: "de-DE" })
} else {
  throw new Error(`Unknown cold Intl benchmark: ${benchmark}`)
}

process.stdout.write(String((performance.now() - start) * 1_000_000))
