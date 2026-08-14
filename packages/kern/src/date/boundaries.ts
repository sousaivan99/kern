import { assertValidDate, copyDate } from "./shared.js"
import { endOfDayWithTemporal, startOfDayWithTemporal } from "./temporal.js"

/** Returns a copy at the start of its host-local calendar day. */
export const startOfDay = (date: Date): Date => {
  assertValidDate(date)
  const temporal = startOfDayWithTemporal(date)
  if (temporal) return temporal
  const output = copyDate(date)
  output.setHours(0, 0, 0, 0)
  return output
}

/** Returns a copy at the last millisecond of its host-local calendar day. */
export const endOfDay = (date: Date): Date => {
  assertValidDate(date)
  const temporal = endOfDayWithTemporal(date)
  if (temporal) return temporal
  const output = copyDate(date)
  output.setHours(23, 59, 59, 999)
  return output
}
