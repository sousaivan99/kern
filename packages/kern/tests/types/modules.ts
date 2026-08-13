import {
  first,
  groupBy,
  last,
  type NonFalsy,
  partition,
  unique,
  withoutFalsy,
} from "../../src/array/index.js"
import { debounce, once } from "../../src/async/index.js"
import {
  differenceInCalendarDays,
  formatRelativeTime,
  isAfter,
  isBefore,
  isSameDay,
  isSameInstant,
  isValidDate,
  subtractDays,
} from "../../src/date/index.js"
import { formatMoney, sumMoney } from "../../src/money/index.js"
import {
  formatNumber,
  formatPercentage,
  isBetween,
  percentageOfTotal,
} from "../../src/number/index.js"
import { type DeepReadonly, deepFreeze, hasOwn, hasOwnPath, pick } from "../../src/object/index.js"

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false
type Assert<T extends true> = T

const readonlyValues: readonly (1 | 2)[] = [1, 2]
const firstValue: 1 | 2 | undefined = first(readonlyValues)
const lastValue: 1 | 2 | undefined = last(readonlyValues)
const uniqueValues: Array<1 | 2> = unique(readonlyValues)
const nonFalsyValues: Array<1 | 2> = withoutFalsy([0, 1, false, 2] as const)
const groupedValues = groupBy(readonlyValues, (value) => (value === 1 ? "one" : "two"))
type _GroupedValues = Assert<
  Equal<typeof groupedValues, Partial<Record<"one" | "two", Array<1 | 2>>>>
>
void firstValue
void lastValue
void uniqueValues
void nonFalsyValues
type _NonFalsy = Assert<Equal<NonFalsy<0 | "" | "ready" | null>, "ready">>

const tuple = ["first", 2, true] as const
const tupleFirst = first(tuple)
const tupleLast = last(tuple)
type _InferredFirstTuple = Assert<Equal<typeof tupleFirst, "first">>
type _InferredLastTuple = Assert<Equal<typeof tupleLast, true>>

type PartitionValue =
  | { readonly kind: "count"; readonly value: number }
  | { readonly kind: "text"; readonly value: string }
const partitionValues: readonly PartitionValue[] = [
  { kind: "count", value: 1 },
  { kind: "text", value: "one" },
]
const [textValues, countValues] = partition(
  partitionValues,
  (value): value is Extract<PartitionValue, { kind: "text" }> => value.kind === "text",
)
type _PartitionMatches = Assert<
  Equal<typeof textValues, Array<Extract<PartitionValue, { kind: "text" }>>>
>
type _PartitionRemaining = Assert<
  Equal<typeof countValues, Array<Extract<PartitionValue, { kind: "count" }>>>
>

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

isBetween(1, 0, 2, { inclusive: false })
percentageOfTotal(1, 2)
differenceInCalendarDays(new Date(), new Date())
formatRelativeTime(new Date(), new Date())
isBefore(new Date(), new Date())
isAfter(new Date(), new Date())
isSameInstant(new Date(), new Date())
isSameDay(new Date(), new Date())
subtractDays(new Date(), 1)
hasOwnPath({ nested: true }, "nested")
formatNumber(1234, { locale: "en-US" })
formatPercentage(25, { locale: "en-US" })
formatMoney(1099, "USD", { locale: "en-US" })
sumMoney([100, 25])

const unknownDate: unknown = new Date()
if (isValidDate(unknownDate)) {
  type _ValidDateNarrowing = Assert<Equal<typeof unknownDate, Date>>
}

const unknownValue: unknown = { name: "Ada" }
const ownsName: boolean = hasOwn(unknownValue, "name")
void ownsName

// @ts-expect-error callers cannot override the currency chosen by the positional argument
formatMoney(1099, "USD", { currency: "EUR" })
