import { copyDate } from "./shared.js"

/** Returns a copy at the start of its host-local calendar day. */
export const startOfDay = (date: Date): Date => {
  const output = copyDate(date)
  output.setHours(0, 0, 0, 0)
  return output
}

/** Returns a copy at the last millisecond of its host-local calendar day. */
export const endOfDay = (date: Date): Date => {
  const output = copyDate(date)
  output.setHours(23, 59, 59, 999)
  return output
}
