import {
  chunk,
  first,
  groupBy,
  last,
  partition,
  unique,
  uniqueBy,
  withoutFalsy,
} from "../../dist/array/index.js"
import { once, sleep } from "../../dist/async/index.js"
import {
  addDays,
  differenceInCalendarDays,
  isAfter,
  isBefore,
  isSameDay,
  isSameInstant,
  isValidDate,
  subtractDays,
} from "../../dist/date/index.js"
import {
  allocateMoney,
  formatMoney,
  parseMoney,
  roundMoney,
  sumMoney,
} from "../../dist/money/index.js"
import {
  formatNumber,
  formatPercentage,
  isBetween,
  percentageOfTotal,
} from "../../dist/number/index.js"
import { deepFreeze, hasOwn, hasOwnPath } from "../../dist/object/index.js"
import { slugify, truncate } from "../../dist/string/index.js"
import { object, string } from "../../dist/validation/index.js"

const assert = (condition, message) => {
  if (!condition) throw new Error(`Compatibility smoke failure: ${message}`)
}

const schema = object({ name: string().trim().min(2) })
assert(schema.parse({ name: " Ada " }).name === "Ada", "validation")
assert(schema["~standard"].validate({ name: "Ada" }).value.name === "Ada", "standard schema")
assert(schema.strict().safeParse({ name: "Ada", extra: true }).issues.length === 1, "strict object")
assert(formatMoney(1099, "USD", { locale: "en-US" }) === "$10.99", "money format")
assert(parseMoney("$10.99", "USD", { locale: "en-US" }) === 1099, "money parse")
assert(
  differenceInCalendarDays(addDays(new Date(2024, 0, 1), 1), new Date(2024, 0, 1)) === 1,
  "date",
)
assert(
  isBefore(new Date(0), new Date(1)) && isAfter(new Date(1), new Date(0)),
  "instant comparison",
)
assert(
  isSameInstant(new Date(0), new Date(0)) && isSameDay(new Date(), new Date()),
  "date equality",
)
assert(isValidDate(subtractDays(new Date(2024, 0, 2), 1)), "date validity and subtraction")
assert(isBetween(2, 1, 3) && percentageOfTotal(1, 4) === 25, "number")
assert(formatNumber(1234, { locale: "en-US", useGrouping: false }) === "1234", "number format")
assert(formatPercentage(25, { locale: "en-US" }) === "25%", "percentage format")
assert(sumMoney([100, 25, -10]) === 115, "money sum")
assert(roundMoney(103, { roundingIncrement: 5 }) === 105, "money rounding")
assert(allocateMoney(100, [1, 1, 1]).join(",") === "34,33,33", "money allocation")
assert(slugify("Crème brûlée") === "creme-brulee", "string")
assert(truncate("👨‍👩‍👧‍👦ab", 2) === "👨‍👩‍👧‍👦…", "grapheme truncation")
assert(first([1, 2]) === 1 && last([1, 2]) === 2, "array boundaries")
assert(unique([1, 1, 2]).join(",") === "1,2", "unique")
const grouped = groupBy(["one", "two", "three"], (value) => value.length)
assert(grouped[3]?.join(",") === "one,two" && Object.getPrototypeOf(grouped) === null, "groupBy")
const [short, long] = partition(["a", "bb", "c"], (value) => value.length === 1)
assert(short.join(",") === "a,c" && long.join(",") === "bb", "partition")
assert(uniqueBy([{ id: 1 }, { id: 1 }], (value) => value.id).length === 1, "uniqueBy")
assert(chunk([1, 2, 3], 2).length === 2, "chunk")
assert(withoutFalsy([0, 1, null, 2]).join(",") === "1,2", "withoutFalsy")
assert(hasOwnPath({ nested: { value: true } }, "nested.value"), "hasOwnPath")
assert(hasOwn({ value: true }, "value") && !hasOwn({}, "toString"), "hasOwn")
assert(Object.isFrozen(deepFreeze({ nested: { value: true } }).nested), "deepFreeze")

let calls = 0
const cached = once(() => ++calls)
assert(cached() === 1 && cached() === 1 && calls === 1, "once")
await sleep(0)

export const smokePassed = true
