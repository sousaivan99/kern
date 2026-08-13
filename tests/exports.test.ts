import { describe, expect, test } from "bun:test"
import * as arrayModule from "../src/array/index.js"
import * as dateModule from "../src/date/index.js"
import * as numberModule from "../src/number/index.js"
import * as objectModule from "../src/object/index.js"
import * as validationModule from "../src/validation/index.js"

describe("public export surface", () => {
  test("contains canonical names and omits removed native wrappers", () => {
    expect(arrayModule).not.toHaveProperty("first")
    expect(arrayModule).not.toHaveProperty("last")
    expect(arrayModule).not.toHaveProperty("unique")
    expect(arrayModule).not.toHaveProperty("groupBy")
    expect(dateModule).toHaveProperty("differenceInCalendarDays")
    expect(dateModule).toHaveProperty("formatRelativeTime")
    expect(dateModule).not.toHaveProperty("differenceInDays")
    expect(dateModule).not.toHaveProperty("isBefore")
    expect(dateModule).not.toHaveProperty("isAfter")
    expect(numberModule).toHaveProperty("isBetween")
    expect(numberModule).toHaveProperty("calculatePercentage")
    expect(numberModule).not.toHaveProperty("formatNumber")
    expect(objectModule).toHaveProperty("hasOwnPath")
    expect(objectModule).not.toHaveProperty("has")
    expect(validationModule).toHaveProperty("enumeration")
    expect(validationModule).not.toHaveProperty("enum")
  })
})
