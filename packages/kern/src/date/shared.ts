/** Tests an untrusted value for a valid native `Date` instance. */
export const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime())

export const assertValidDate = (date: Date): void => {
  if (!isValidDate(date)) throw new RangeError("Expected a valid Date")
}

export const copyDate = (date: Date): Date => {
  assertValidDate(date)
  return new Date(date.getTime())
}
