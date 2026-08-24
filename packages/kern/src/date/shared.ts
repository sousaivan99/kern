/** Tests an untrusted value for a valid native `Date` instance. */
export const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime())

export const assertValidDate = (date: Date): number => {
  if (!(date instanceof Date)) throw new RangeError("Expected a valid Date")
  const timestamp = date.getTime()
  if (Number.isNaN(timestamp)) throw new RangeError("Expected a valid Date")
  return timestamp
}

export const assertValidDateResult = (date: Date): Date => {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Date result is outside the supported range")
  }
  return date
}
