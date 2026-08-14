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
  addMonths,
  addYears,
  differenceInCalendarDays,
  endOfDay,
  isAfter,
  isBefore,
  isSameDay,
  isSameInstant,
  isValidDate,
  startOfDay,
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

const installTemporalProbe = () => {
  const temporal = Reflect.get(globalThis, "Temporal")
  if ((typeof temporal !== "object" && typeof temporal !== "function") || temporal === null) {
    return { available: false, calls: () => 0, restore() {} }
  }
  const instant = Reflect.get(temporal, "Instant")
  const now = Reflect.get(temporal, "Now")
  if ((typeof instant !== "object" && typeof instant !== "function") || instant === null) {
    return { available: false, calls: () => 0, restore() {} }
  }
  if ((typeof now !== "object" && typeof now !== "function") || now === null) {
    return { available: false, calls: () => 0, restore() {} }
  }
  const fromEpochMilliseconds = Reflect.get(instant, "fromEpochMilliseconds")
  const timeZoneId = Reflect.get(now, "timeZoneId")
  if (typeof fromEpochMilliseconds !== "function" || typeof timeZoneId !== "function") {
    return { available: false, calls: () => 0, restore() {} }
  }

  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Temporal")
  let calls = 0
  Object.defineProperty(globalThis, "Temporal", {
    configurable: true,
    value: {
      Instant: {
        fromEpochMilliseconds(value) {
          calls += 1
          return Reflect.apply(fromEpochMilliseconds, instant, [value])
        },
      },
      Now: {
        timeZoneId() {
          calls += 1
          return Reflect.apply(timeZoneId, now, [])
        },
      },
    },
    writable: true,
  })
  return {
    available: true,
    calls: () => calls,
    restore() {
      if (descriptor) Object.defineProperty(globalThis, "Temporal", descriptor)
      else Reflect.deleteProperty(globalThis, "Temporal")
    },
  }
}

const temporalProbe = installTemporalProbe()

const legacyAddDays = (date, amount) => {
  const output = new Date(date.getTime())
  output.setDate(output.getDate() + amount)
  return output
}

const legacyAddMonths = (date, amount) => {
  const output = new Date(date.getTime())
  const day = output.getDate()
  output.setDate(1)
  output.setMonth(output.getMonth() + amount)
  const monthEnd = new Date(output.getTime())
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0)
  output.setDate(Math.min(day, monthEnd.getDate()))
  return output
}

const legacyStartOfDay = (date) => {
  const output = new Date(date.getTime())
  output.setHours(0, 0, 0, 0)
  return output
}

const legacyEndOfDay = (date) => {
  const output = new Date(date.getTime())
  output.setHours(23, 59, 59, 999)
  return output
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
for (const input of [
  new Date(2024, 0, 31, 12, 30),
  new Date(2024, 2, 10, 1, 30),
  new Date(2024, 9, 27, 1, 30),
]) {
  assert(addDays(input, 1).getTime() === legacyAddDays(input, 1).getTime(), "Temporal addDays")
  assert(
    addMonths(input, 1).getTime() === legacyAddMonths(input, 1).getTime(),
    "Temporal addMonths",
  )
  assert(addYears(input, 1).getTime() === legacyAddMonths(input, 12).getTime(), "Temporal addYears")
  assert(startOfDay(input).getTime() === legacyStartOfDay(input).getTime(), "Temporal startOfDay")
  assert(endOfDay(input).getTime() === legacyEndOfDay(input).getTime(), "Temporal endOfDay")
}
if (temporalProbe.available) {
  assert(temporalProbe.calls() > 0, "native Temporal path")
}
temporalProbe.restore()
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
