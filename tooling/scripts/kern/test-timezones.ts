import { join, resolve } from "node:path"
import { progress } from "@clack/prompts"
import { printCapturedFailure, runCaptured } from "../shared/process.js"

const timeZones = ["UTC", "America/New_York", "Europe/Luxembourg"] as const
const root = join(resolve(import.meta.dir, "../../.."), "packages", "kern")
const bar = progress({ max: timeZones.length, size: 32, style: "block" })

bar.start(`0/${timeZones.length} · Preparing timezone tests`)
for (let index = 0; index < timeZones.length; index += 1) {
  const timeZone = timeZones[index] as (typeof timeZones)[number]
  bar.message(`${index}/${timeZones.length} · ${timeZone}`)
  const result = await runCaptured([process.execPath, "test", "tests/date.test.ts"], {
    cwd: root,
    env: { ...process.env, TZ: timeZone },
  })
  if (result.exitCode !== 0) {
    bar.error(`Date tests failed in ${timeZone}`)
    printCapturedFailure(result)
    process.exit(result.exitCode)
  }
  bar.advance(1, `${index + 1}/${timeZones.length} · ${timeZone}`)
}

bar.stop(`Date tests passed in ${timeZones.length} time zones`)
