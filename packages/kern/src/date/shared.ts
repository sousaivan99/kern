/** Tests an untrusted value for a valid native `Date` instance. */
export const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime())

export const assertValidDate = (date: Date): number => {
  if (!(date instanceof Date)) throw new RangeError("Expected a valid Date")
  const timestamp = date.getTime()
  if (Number.isNaN(timestamp)) throw new RangeError("Expected a valid Date")
  return timestamp
}
