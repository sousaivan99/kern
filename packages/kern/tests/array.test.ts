import { describe, expect, test } from "bun:test"
import {
  chunk,
  first,
  groupBy,
  last,
  partition,
  unique,
  uniqueBy,
  withoutFalsy,
} from "../src/array/index.js"

describe("array", () => {
  test("reads boundary values without mutating the input", () => {
    const values: readonly number[] = [1, 2, 3]
    expect(first(values)).toBe(1)
    expect(last(values)).toBe(3)
    expect(first([])).toBeUndefined()
    expect(last([])).toBeUndefined()
    expect(values).toEqual([1, 2, 3])
  })

  test("removes duplicate values with stable Set semantics", () => {
    expect(unique([2, 1, 2, Number.NaN, Number.NaN, 1])).toEqual([2, 1, Number.NaN])
  })

  test("groups values into a safe null-prototype object", () => {
    const symbol = Symbol("symbol group")
    const values = [
      { group: "first" as PropertyKey, value: 1 },
      { group: "first" as PropertyKey, value: 2 },
      { group: "__proto__" as PropertyKey, value: 3 },
      { group: symbol as PropertyKey, value: 4 },
    ]
    const grouped = groupBy(values, (value) => value.group)
    const prototypeGroup: typeof values | undefined = Reflect.get(grouped, "__proto__")

    expect(Object.getPrototypeOf(grouped)).toBeNull()
    expect(grouped.first?.map((value) => value.value)).toEqual([1, 2])
    expect(prototypeGroup?.map((value) => value.value)).toEqual([3])
    expect(grouped[symbol]?.map((value) => value.value)).toEqual([4])
    expect(grouped.missing).toBeUndefined()
  })

  test("partitions values once while preserving order", () => {
    const values = [1, 2, 3, 4]
    const visited: number[] = []
    const [even, odd] = partition(values, (value, index) => {
      visited.push(index)
      return value % 2 === 0
    })

    expect(even).toEqual([2, 4])
    expect(odd).toEqual([1, 3])
    expect(visited).toEqual([0, 1, 2, 3])
    expect(values).toEqual([1, 2, 3, 4])
  })

  test("provides collection operations beyond native one-liners", () => {
    expect(uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], (value) => value.id)).toEqual([
      { id: 1 },
      { id: 2 },
    ])
    expect(uniqueBy([10, 20, 30], (_value, index) => index % 2)).toEqual([10, 20])
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(withoutFalsy([0, 1, false, 2, "", "ok", null, undefined])).toEqual([1, 2, "ok"])
  })

  test("rejects invalid chunk sizes", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError)
  })
})
