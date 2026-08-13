import * as arrayModule from "../../src/array/index.js"
import { debounce, once } from "../../src/async/index.js"
import { differenceInCalendarDays, formatRelativeTime } from "../../src/date/index.js"
import { formatMoney } from "../../src/money/index.js"
import { calculatePercentage, isBetween } from "../../src/number/index.js"
import { type DeepReadonly, deepFreeze, hasOwnPath, pick } from "../../src/object/index.js"

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false
type Assert<T extends true> = T

// @ts-expect-error native first-element access is not wrapped
arrayModule.first
// @ts-expect-error native grouping is not wrapped
arrayModule.groupBy

const frozen = deepFreeze({ nested: { count: 1 }, values: ["a", "b"] as const })
type _FrozenCount = Assert<Equal<typeof frozen.nested.count, number>>
type _FrozenTuple = Assert<Equal<typeof frozen.values, readonly ["a", "b"]>>

// @ts-expect-error Map has mutable internal slots and is unsupported
deepFreeze(new Map<string, number>())
// @ts-expect-error nested mutable built-ins are unsupported
deepFreeze({ cache: new Set<string>() })
type _UnsupportedDate = Assert<Equal<DeepReadonly<Date>, never>>

const selected = pick({ id: 1, name: "Ada" }, ["id"])
type _Selected = Assert<Equal<typeof selected, Pick<{ id: number; name: string }, "id">>>

const scheduled = debounce((value: number) => value.toString(), 10)
scheduled(1)
const flushed: string | undefined = scheduled.flush()
void flushed

const cached = once((left: number, right: number) => left + right)
const result: number = cached(1, 2)
void result

isBetween(1, 0, 2)
calculatePercentage(1, 2)
differenceInCalendarDays(new Date(), new Date())
formatRelativeTime(new Date(), new Date())
hasOwnPath({ nested: true }, "nested")
formatMoney(1099, "USD", { locale: "en-US" })

// @ts-expect-error callers cannot override the currency chosen by the positional argument
formatMoney(1099, "USD", { currency: "EUR" })
