import { describe, expect, test } from "bun:test"
import currency from "currency.js"
import * as dinero from "dinero.js"
import * as es from "es-toolkit"
import * as lodash from "lodash-es"
import * as kernArray from "../../packages/kern/src/array/index.js"
import * as kernMoney from "../../packages/kern/src/money/index.js"
import * as kernNumber from "../../packages/kern/src/number/index.js"
import * as kernObject from "../../packages/kern/src/object/index.js"

describe("module benchmark semantic intersections", () => {
  test("array and plain-object adapters return equal observable values", () => {
    const values = [1, 2, 1, 3, 2]
    const records = values.map((identity) => ({ identity }))
    const identity = (value: { readonly identity: number }): number => value.identity
    const parity = (value: number): boolean => value % 2 === 0
    expect([kernArray.unique(values), es.uniq(values), lodash.uniq(values)]).toEqual([
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ])
    expect([
      kernArray.uniqueBy(records, identity),
      es.uniqBy(records, identity),
      lodash.uniqBy(records, identity),
    ]).toEqual([
      [{ identity: 1 }, { identity: 2 }, { identity: 3 }],
      [{ identity: 1 }, { identity: 2 }, { identity: 3 }],
      [{ identity: 1 }, { identity: 2 }, { identity: 3 }],
    ])
    expect([
      kernArray.partition(values, parity),
      es.partition(values, parity),
      lodash.partition(values, parity),
    ]).toEqual([
      [
        [2, 2],
        [1, 1, 3],
      ],
      [
        [2, 2],
        [1, 1, 3],
      ],
      [
        [2, 2],
        [1, 1, 3],
      ],
    ])

    const source = { a: 1, b: 2, c: 3 }
    expect([
      kernObject.pick(source, ["a", "c"]),
      es.pick(source, ["a", "c"]),
      lodash.pick(source, ["a", "c"]),
    ]).toEqual([
      { a: 1, c: 3 },
      { a: 1, c: 3 },
      { a: 1, c: 3 },
    ])
  })

  test("all rotating number fixtures return equal results", () => {
    for (const value of Array.from({ length: 32 }, (_, index) => index - 12.25)) {
      expect([
        kernNumber.clamp(value, -5, 10),
        es.clamp(value, -5, 10),
        lodash.clamp(value, -5, 10),
      ]).toEqual(Array.from({ length: 3 }, () => Math.min(10, Math.max(-5, value))))

      const rounded = kernNumber.round(value / 7, 2)
      expect([rounded, es.round(value / 7, 2), lodash.round(value / 7, 2)]).toEqual([
        rounded,
        rounded,
        rounded,
      ])

      const inRange = value >= -5 && value < 10
      expect([
        kernNumber.isBetween(value, -5, 10, { inclusive: false }),
        es.inRange(value, -5, 10),
        lodash.inRange(value, -5, 10),
      ]).toEqual([inRange, inRange, inRange])
    }
  })

  test("money adapters preserve equal minor-unit results", () => {
    for (const index of Array.from({ length: 32 }, (_, value) => value)) {
      const left = 1_999 + index
      const right = 160 + (index % 3)
      const dLeft = dinero.dinero({ amount: left, currency: dinero.USD })
      const dRight = dinero.dinero({ amount: right, currency: dinero.USD })
      const cLeft = currency(left, { fromCents: true })
      const cRight = currency(right, { fromCents: true })

      expect([
        kernMoney.addMoney(left, right),
        dinero.toSnapshot(dinero.add(dLeft, dRight)).amount,
        cLeft.add(cRight).intValue,
      ]).toEqual([left + right, left + right, left + right])

      const expected = kernMoney.multiplyMoney(left, 1.15)
      const dineroProduct = dinero.transformScale(
        dinero.multiply(dLeft, { amount: 115, scale: 2 }),
        2,
        dinero.halfAwayFromZero,
      )
      expect([
        expected,
        dinero.toSnapshot(dineroProduct).amount,
        cLeft.multiply(1.15).intValue,
      ]).toEqual([expected, expected, expected])
    }

    const expected = kernMoney.allocateMoney(
      10_003,
      Array.from({ length: 8 }, () => 1),
    )
    const dineroShares = dinero
      .allocate(
        dinero.dinero({ amount: 10_003, currency: dinero.USD }),
        Array.from({ length: 8 }, () => ({ amount: 1, scale: 0 })),
      )
      .map((value) => dinero.toSnapshot(value).amount)
    const currencyShares = currency(10_003, { fromCents: true })
      .distribute(8)
      .map((value) => value.intValue)
    expect([expected, dineroShares, currencyShares]).toEqual([expected, expected, expected])
  })
})
