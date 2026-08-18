import { cpus } from "node:os"
import { formatDate } from "../../packages/kern/src/date/index.js"
import { formatMoney, parseMoney } from "../../packages/kern/src/money/index.js"
import { formatNumber } from "../../packages/kern/src/number/index.js"

const locales = Array.from({ length: 128 }, (_, index) => `en-US-x-m${index}`)
const date = new Date("2025-01-02T12:00:00Z")

const snapshot = (round: number) => {
  Bun.gc(true)
  const memory = process.memoryUsage()
  return { heapUsed: memory.heapUsed, round, rss: memory.rss }
}

const samples = [snapshot(0)]
for (let round = 1; round <= 12; round += 1) {
  for (const locale of locales) {
    formatNumber(1_234.5, { locale, maximumFractionDigits: 1 })
    formatDate(date, {
      day: "numeric",
      locale,
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    })
    formatMoney(1_234, "USD", { locale })
    parseMoney("$12.34", "USD", { locale })
  }
  samples.push(snapshot(round))
}

console.log(
  JSON.stringify(
    {
      metadata: {
        architecture: process.arch,
        cpu: cpus()[0]?.model ?? "unknown",
        platform: process.platform,
        runtime: `Bun ${Bun.version}`,
        timestamp: new Date().toISOString(),
      },
      samples,
    },
    null,
    2,
  ),
)
