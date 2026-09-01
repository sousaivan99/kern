export const assertMinorUnits = (value: number): void => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Money values must be safe integers in minor units")
  }
}

export const checkedNumber = (value: bigint): number => {
  const output = Number(value)
  if (!Number.isSafeInteger(output)) {
    throw new RangeError("Money result exceeds the safe integer range")
  }
  return output
}
