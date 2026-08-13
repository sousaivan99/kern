import { describe, expect, test } from "bun:test"
import { chunk, compact, uniqueBy } from "../src/array/index.js"

describe("array", () => {
  test("provides collection operations beyond native one-liners", () => {
    expect(uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], (value) => value.id)).toEqual([
      { id: 1 },
      { id: 2 },
    ])
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(compact([0, 1, false, 2, "", "ok", null, undefined])).toEqual([1, 2, "ok"])
  })

  test("rejects invalid chunk sizes", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError)
  })
})
