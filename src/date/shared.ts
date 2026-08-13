export const assertValidDate = (date: Date): void => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    throw new RangeError("Expected a valid Date")
}

export const copyDate = (date: Date): Date => {
  assertValidDate(date)
  return new Date(date.getTime())
}
