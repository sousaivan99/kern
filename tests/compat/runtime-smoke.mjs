import { chunk, compact, uniqueBy } from "../../dist/array/index.js"
import { once, sleep } from "../../dist/async/index.js"
import { addDays, differenceInCalendarDays } from "../../dist/date/index.js"
import { formatMoney, parseMoney } from "../../dist/money/index.js"
import { calculatePercentage, isBetween } from "../../dist/number/index.js"
import { deepFreeze, hasOwnPath } from "../../dist/object/index.js"
import { slugify } from "../../dist/string/index.js"
import { object, string } from "../../dist/validation/index.js"

const assert = (condition, message) => {
  if (!condition) throw new Error(`Compatibility smoke failure: ${message}`)
}

const schema = object({ name: string().trim().min(2) })
assert(schema.parse({ name: " Ada " }).name === "Ada", "validation")
assert(formatMoney(1099, "USD", { locale: "en-US" }) === "$10.99", "money format")
assert(parseMoney("$10.99", "USD", { locale: "en-US" }) === 1099, "money parse")
assert(
  differenceInCalendarDays(addDays(new Date(2024, 0, 1), 1), new Date(2024, 0, 1)) === 1,
  "date",
)
assert(isBetween(2, 1, 3) && calculatePercentage(1, 4) === 25, "number")
assert(slugify("Crème brûlée") === "creme-brulee", "string")
assert(uniqueBy([{ id: 1 }, { id: 1 }], (value) => value.id).length === 1, "uniqueBy")
assert(chunk([1, 2, 3], 2).length === 2, "chunk")
assert(compact([0, 1, null, 2]).join(",") === "1,2", "compact")
assert(hasOwnPath({ nested: { value: true } }, "nested.value"), "hasOwnPath")
assert(Object.isFrozen(deepFreeze({ nested: { value: true } }).nested), "deepFreeze")

let calls = 0
const cached = once(() => ++calls)
assert(cached() === 1 && cached() === 1 && calls === 1, "once")
await sleep(0)

export const smokePassed = true
