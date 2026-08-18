import { assertValidDate } from "./shared.js"
import { endOfDayWithTemporal, startOfDayWithTemporal } from "./temporal.js"

/** Returns a copy at the start of its host-local calendar day. */
export const startOfDay = (date: Date): Date => {
  const timestamp = assertValidDate(date)
  const temporal = startOfDayWithTemporal(date)
  if (temporal) return temporal
  const output = new Date(timestamp)
  output.setHours(0, 0, 0, 0)
  return output
}

/** Returns a copy at the last millisecond of its host-local calendar day. */
export const endOfDay = (date: Date): Date => {
  const timestamp = assertValidDate(date)
  const temporal = endOfDayWithTemporal(date)
  if (temporal) return temporal
  const output = new Date(timestamp)
  output.setHours(23, 59, 59, 999)
  return output
}
