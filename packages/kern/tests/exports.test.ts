import { describe, expect, test } from "bun:test"
import * as arrayModule from "../src/array/index.js"
import * as dateModule from "../src/date/index.js"
import * as moneyModule from "../src/money/index.js"
import * as numberModule from "../src/number/index.js"
import * as objectModule from "../src/object/index.js"
import * as validationModule from "../src/validation/index.js"

describe("public export surface", () => {
  test("contains canonical names and omits ambiguous aliases", () => {
    expect(arrayModule).toHaveProperty("first")
    expect(arrayModule).toHaveProperty("last")
    expect(arrayModule).toHaveProperty("unique")
    expect(arrayModule).toHaveProperty("groupBy")
    expect(arrayModule).toHaveProperty("withoutFalsy")
    expect(arrayModule).toHaveProperty("partition")
    expect(arrayModule).not.toHaveProperty("compact")
    expect(dateModule).toHaveProperty("differenceInCalendarDays")
    expect(dateModule).toHaveProperty("formatRelativeTime")
    expect(dateModule).not.toHaveProperty("differenceInDays")
    expect(dateModule).toHaveProperty("isBefore")
    expect(dateModule).toHaveProperty("isAfter")
    expect(dateModule).toHaveProperty("isSameInstant")
    expect(dateModule).toHaveProperty("isSameDay")
    expect(dateModule).toHaveProperty("isValidDate")
    expect(dateModule).toHaveProperty("subtractDays")
    expect(dateModule).toHaveProperty("subtractMonths")
    expect(dateModule).toHaveProperty("subtractYears")
    expect(dateModule).toHaveProperty("toUTCISODate")
    expect(dateModule).not.toHaveProperty("toISODate")
    expect(numberModule).toHaveProperty("isBetween")
    expect(numberModule).toHaveProperty("percentageOfTotal")
    expect(numberModule).toHaveProperty("formatNumber")
    expect(numberModule).toHaveProperty("formatPercentage")
    expect(numberModule).not.toHaveProperty("calculatePercentage")
    expect(numberModule).not.toHaveProperty("formatPercent")
    expect(moneyModule).toHaveProperty("sumMoney")
    expect(moneyModule).toHaveProperty("roundMoney")
    expect(moneyModule).toHaveProperty("allocateMoney")
    expect(objectModule).toHaveProperty("hasOwnPath")
    expect(objectModule).toHaveProperty("hasOwn")
    expect(objectModule).not.toHaveProperty("has")
    expect(validationModule).toHaveProperty("enumeration")
    expect(validationModule).not.toHaveProperty("enum")
  })
})
