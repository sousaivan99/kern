export const present = <T>(values: readonly T[]): Array<NonNullable<T>> =>
  values.filter((value): value is NonNullable<T> => value !== null && value !== undefined)
