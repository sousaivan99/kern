import currency from "currency.js"
import * as dateFns from "date-fns"
import dayjs from "dayjs"
import * as dinero from "dinero.js"
import * as es from "es-toolkit"
import { truncate as esTruncate } from "es-toolkit/compat"
import * as lodash from "lodash-es"
import pRetry from "p-retry"
import kernMetadata from "../../packages/kern/package.json"
import * as array from "../../packages/kern/src/array/index.js"
import * as async from "../../packages/kern/src/async/index.js"
import * as date from "../../packages/kern/src/date/index.js"
import * as money from "../../packages/kern/src/money/index.js"
import * as number from "../../packages/kern/src/number/index.js"
import * as object from "../../packages/kern/src/object/index.js"
import * as string from "../../packages/kern/src/string/index.js"
import currencyMetadata from "../node_modules/currency.js/package.json"
import dateFnsMetadata from "../node_modules/date-fns/package.json"
import dayjsMetadata from "../node_modules/dayjs/package.json"
import dineroMetadata from "../node_modules/dinero.js/package.json"
import esMetadata from "../node_modules/es-toolkit/package.json"
import lodashMetadata from "../node_modules/lodash-es/package.json"
import pRetryMetadata from "../node_modules/p-retry/package.json"
import { type BenchmarkCase, invariant } from "./harness.js"

interface Library {
  readonly name: string
  readonly version: string
}
interface Adapter extends Library {
  readonly async?: boolean
  readonly run: () => unknown | Promise<unknown>
  readonly verify: (result: unknown) => void | Promise<void>
}
interface Scenario {
  readonly adapters: readonly Adapter[]
  readonly category: string
  readonly id: string
  readonly items?: number
  readonly iterationCap?: number
  readonly name: string
  readonly size?: number
  readonly suite: string
  readonly unit?: string
}

const lib = {
  currency: { name: "currency.js", version: currencyMetadata.version },
  dateFns: { name: "date-fns", version: dateFnsMetadata.version },
  dayjs: { name: "Day.js", version: dayjsMetadata.version },
  dinero: { name: "Dinero.js", version: dineroMetadata.version },
  es: { name: "es-toolkit", version: esMetadata.version },
  kern: { name: "Kern", version: kernMetadata.version },
  lodash: { name: "Lodash", version: lodashMetadata.version },
  pRetry: { name: "p-retry", version: pRetryMetadata.version },
} as const
const use = (
  library: Library,
  run: Adapter["run"],
  verify: Adapter["verify"],
  isAsync = false,
): Adapter => ({ ...library, ...(isAsync ? { async: true } : {}), run, verify })
const equal =
  (expected: unknown) =>
  (result: unknown): void =>
    invariant(Object.is(result, expected), `expected ${String(expected)}, got ${String(result)}`)
const length =
  (expected: number) =>
  (result: unknown): void =>
    invariant(Array.isArray(result) && result.length === expected, `expected ${expected} values`)
const ownKeys =
  (expected: number) =>
  (result: unknown): void =>
    invariant(
      typeof result === "object" && result !== null && Reflect.ownKeys(result).length === expected,
      `expected ${expected} own keys`,
    )
const rotating = <Input, Output>(
  inputs: readonly Input[],
  operation: (input: Input) => Output,
): (() => Output) => {
  let index = 0
  return () => operation(inputs[index++ % inputs.length] as Input)
}
const expand = (definition: Scenario): BenchmarkCase[] =>
  definition.adapters.map((entry) => ({
    ...(entry.async ? { async: true } : {}),
    category: definition.category,
    id: definition.id,
    ...(definition.items === undefined ? {} : { itemsPerOperation: definition.items }),
    ...(definition.iterationCap === undefined ? {} : { iterationCap: definition.iterationCap }),
    library: entry.name,
    libraryVersion: entry.version,
    name: definition.name,
    run: entry.run,
    ...(definition.size === undefined ? {} : { size: definition.size }),
    suite: definition.suite,
    ...(definition.unit === undefined ? {} : { unit: definition.unit }),
    verify: entry.verify,
  }))

const values = Array.from({ length: 10_000 }, (_, index) => index % 5_000)
const records = values.map((identity) => ({ identity }))
const identity = (value: { readonly identity: number }): number => value.identity
const parity = (value: number): boolean => value % 2 === 0
const arrayCases: readonly Scenario[] = [
  {
    adapters: [
      use(lib.kern, () => array.unique(values), length(5_000)),
      use(lib.es, () => es.uniq(values), length(5_000)),
      use(lib.lodash, () => lodash.uniq(values), length(5_000)),
    ],
    category: "deduplication",
    id: "array-compare:unique:10000",
    items: 10_000,
    name: "unique 10,000 values (50% distinct)",
    size: 10_000,
    suite: "array-compare",
    unit: "values",
  },
  {
    adapters: [
      use(lib.kern, () => array.uniqueBy(records, identity), length(5_000)),
      use(lib.es, () => es.uniqBy(records, identity), length(5_000)),
      use(lib.lodash, () => lodash.uniqBy(records, identity), length(5_000)),
    ],
    category: "deduplication",
    id: "array-compare:unique-by:10000",
    items: 10_000,
    name: "uniqueBy 10,000 objects (50% distinct)",
    size: 10_000,
    suite: "array-compare",
    unit: "values",
  },
  {
    adapters: [
      use(lib.kern, () => array.partition(values, parity), length(2)),
      use(lib.es, () => es.partition(values, parity), length(2)),
      use(lib.lodash, () => lodash.partition(values, parity), length(2)),
    ],
    category: "partitioning",
    id: "array-compare:partition:10000",
    items: 10_000,
    name: "partition 10,000 values by parity",
    size: 10_000,
    suite: "array-compare",
    unit: "values",
  },
]

const source = Object.fromEntries(
  Array.from({ length: 1_000 }, (_, index) => [`key${index}`, index]),
)
const keys = Array.from({ length: 100 }, (_, index) => `key${index}`)
const objectCases: readonly Scenario[] = [
  {
    adapters: [
      use(lib.kern, () => object.pick(source, keys), ownKeys(100)),
      use(lib.es, () => es.pick(source, keys), ownKeys(100)),
      use(lib.lodash, () => lodash.pick(source, keys), ownKeys(100)),
    ],
    category: "copying",
    id: "object-compare:pick:100-of-1000",
    items: 100,
    name: "pick 100 keys from 1,000-key plain object",
    size: 100,
    suite: "object-compare",
    unit: "selected keys",
  },
  {
    adapters: [
      use(lib.kern, () => object.omit(source, keys), ownKeys(900)),
      use(lib.es, () => es.omit(source, keys), ownKeys(900)),
      use(lib.lodash, () => lodash.omit(source, keys), ownKeys(900)),
    ],
    category: "copying",
    id: "object-compare:omit:100-of-1000",
    items: 1_000,
    name: "omit 100 keys from 1,000-key plain object",
    size: 1_000,
    suite: "object-compare",
    unit: "source keys",
  },
]

const text = "customer account profile value ".repeat(12).trim()
const camel = string.camelCase(text)
const kebab = string.kebabCase(text)
const stringCases: readonly Scenario[] = [
  {
    adapters: [
      use(lib.kern, () => string.camelCase(text), equal(camel)),
      use(lib.es, () => es.camelCase(text), equal(camel)),
      use(lib.lodash, () => lodash.camelCase(text), equal(camel)),
    ],
    category: "case conversion",
    id: "string-compare:camel-case",
    items: text.length,
    name: "camelCase realistic ASCII phrase",
    size: text.length,
    suite: "string-compare",
    unit: "UTF-16 code units",
  },
  {
    adapters: [
      use(lib.kern, () => string.kebabCase(text), equal(kebab)),
      use(lib.es, () => es.kebabCase(text), equal(kebab)),
      use(lib.lodash, () => lodash.kebabCase(text), equal(kebab)),
    ],
    category: "case conversion",
    id: "string-compare:kebab-case",
    items: text.length,
    name: "kebabCase realistic ASCII phrase",
    size: text.length,
    suite: "string-compare",
    unit: "UTF-16 code units",
  },
  {
    adapters: [
      use(
        lib.kern,
        () => string.truncate(text, 32, "..."),
        equal("customer account profile valu..."),
      ),
      use(
        lib.es,
        () => esTruncate(text, { length: 32, omission: "..." }),
        equal("customer account profile valu..."),
      ),
      use(
        lib.lodash,
        () => lodash.truncate(text, { length: 32, omission: "..." }),
        equal("customer account profile valu..."),
      ),
    ],
    category: "truncation",
    id: "string-compare:truncate",
    items: text.length,
    name: "truncate ASCII phrase to 32 characters",
    size: text.length,
    suite: "string-compare",
    unit: "UTF-16 code units",
  },
]

const numericInputs = Array.from({ length: 32 }, (_, index) => index - 12.25)
const finiteNumber = (result: unknown): void =>
  invariant(typeof result === "number" && Number.isFinite(result), "expected a finite number")
const boolean = (result: unknown): void =>
  invariant(typeof result === "boolean", "expected boolean")
const numberCases: readonly Scenario[] = [
  {
    adapters: [
      use(
        lib.kern,
        rotating(numericInputs, (value) => number.clamp(value, -5, 10)),
        finiteNumber,
      ),
      use(
        lib.es,
        rotating(numericInputs, (value) => es.clamp(value, -5, 10)),
        finiteNumber,
      ),
      use(
        lib.lodash,
        rotating(numericInputs, (value) => lodash.clamp(value, -5, 10)),
        finiteNumber,
      ),
    ],
    category: "bounds",
    id: "number-compare:clamp",
    name: "clamp finite number to ordered bounds",
    suite: "number-compare",
  },
  {
    adapters: [
      use(
        lib.kern,
        rotating(numericInputs, (value) => number.round(value / 7, 2)),
        finiteNumber,
      ),
      use(
        lib.es,
        rotating(numericInputs, (value) => es.round(value / 7, 2)),
        finiteNumber,
      ),
      use(
        lib.lodash,
        rotating(numericInputs, (value) => lodash.round(value / 7, 2)),
        finiteNumber,
      ),
    ],
    category: "rounding",
    id: "number-compare:round",
    name: "round finite number to two decimal places",
    suite: "number-compare",
  },
  {
    adapters: [
      use(
        lib.kern,
        rotating(numericInputs, (value) => number.isBetween(value, -5, 10, { inclusive: false })),
        boolean,
      ),
      use(
        lib.es,
        rotating(numericInputs, (value) => es.inRange(value, -5, 10)),
        boolean,
      ),
      use(
        lib.lodash,
        rotating(numericInputs, (value) => lodash.inRange(value, -5, 10)),
        boolean,
      ),
    ],
    category: "bounds",
    id: "number-compare:half-open-range",
    name: "test finite number inside half-open range",
    suite: "number-compare",
  },
]

const inputDate = new Date(2024, 0, 31, 12, 34, 56, 789)
const later = new Date(2025, 5, 20, 22)
const earlier = new Date(2025, 5, 10, 2)
const instant =
  (expected: number) =>
  (result: unknown): void =>
    invariant(
      (result instanceof Date || dayjs.isDayjs(result)) && result.valueOf() === expected,
      `expected instant ${expected}`,
    )
const dateCase = (
  id: string,
  name: string,
  category: string,
  runs: readonly [() => unknown, () => unknown, () => unknown],
  verify: Adapter["verify"],
): Scenario => ({
  adapters: [
    use(lib.kern, runs[0], verify),
    use(lib.dateFns, runs[1], verify),
    use(lib.dayjs, runs[2], verify),
  ],
  category,
  id,
  name,
  suite: "date-compare",
})
const dateCases: readonly Scenario[] = [
  dateCase(
    "date-compare:add-days",
    "add 10 local-calendar days",
    "calendar arithmetic",
    [
      () => date.addDays(inputDate, 10),
      () => dateFns.addDays(inputDate, 10),
      () => dayjs(inputDate).add(10, "day"),
    ],
    instant(dateFns.addDays(inputDate, 10).valueOf()),
  ),
  dateCase(
    "date-compare:add-month",
    "add one month with month-end clamping",
    "calendar arithmetic",
    [
      () => date.addMonths(inputDate, 1),
      () => dateFns.addMonths(inputDate, 1),
      () => dayjs(inputDate).add(1, "month"),
    ],
    instant(dateFns.addMonths(inputDate, 1).valueOf()),
  ),
  dateCase(
    "date-compare:start-of-day",
    "start of host-local day",
    "boundaries",
    [
      () => date.startOfDay(inputDate),
      () => dateFns.startOfDay(inputDate),
      () => dayjs(inputDate).startOf("day"),
    ],
    instant(dateFns.startOfDay(inputDate).valueOf()),
  ),
  dateCase(
    "date-compare:difference-days",
    "difference between local calendar days",
    "comparison",
    [
      () => date.differenceInCalendarDays(later, earlier),
      () => dateFns.differenceInCalendarDays(later, earlier),
      () => dayjs(later).startOf("day").diff(dayjs(earlier).startOf("day"), "day"),
    ],
    equal(10),
  ),
]

const dBase = dinero.dinero({ amount: 1_999, currency: dinero.USD })
const ratios = Array.from({ length: 8 }, () => 1)
const moneyInputs = Array.from({ length: 32 }, (_, index) => ({
  left: 1_999 + index,
  right: 160 + (index % 3),
}))
const dineroInputs = moneyInputs.map(({ left, right }) => ({
  left: dinero.dinero({ amount: left, currency: dinero.USD }),
  right: dinero.dinero({ amount: right, currency: dinero.USD }),
}))
const currencyInputs = moneyInputs.map(({ left, right }) => ({
  left: currency(left, { fromCents: true }),
  right: currency(right, { fromCents: true }),
}))
const safeMinorUnits = (result: unknown): void =>
  invariant(typeof result === "number" && Number.isSafeInteger(result), "expected safe minor units")
const safeDinero = (result: unknown): void =>
  invariant(
    Number.isSafeInteger(dinero.toSnapshot(result as typeof dBase).amount),
    "expected safe Dinero amount",
  )
const safeCurrency = (result: unknown): void =>
  invariant(
    typeof result === "object" &&
      result !== null &&
      "intValue" in result &&
      Number.isSafeInteger(result.intValue),
    "expected safe currency.js amount",
  )
const moneyCases: readonly Scenario[] = [
  {
    adapters: [
      use(
        lib.kern,
        rotating(moneyInputs, ({ left, right }) => money.addMoney(left, right)),
        safeMinorUnits,
      ),
      use(
        lib.dinero,
        rotating(dineroInputs, ({ left, right }) => dinero.add(left, right)),
        safeDinero,
      ),
      use(
        lib.currency,
        rotating(currencyInputs, ({ left, right }) => left.add(right)),
        safeCurrency,
      ),
    ],
    category: "arithmetic",
    id: "money-compare:add",
    name: "add two USD minor-unit amounts",
    suite: "money-compare",
  },
  {
    adapters: [
      use(
        lib.kern,
        rotating(moneyInputs, ({ left, right }) => money.subtractMoney(left, right)),
        safeMinorUnits,
      ),
      use(
        lib.dinero,
        rotating(dineroInputs, ({ left, right }) => dinero.subtract(left, right)),
        safeDinero,
      ),
      use(
        lib.currency,
        rotating(currencyInputs, ({ left, right }) => left.subtract(right)),
        safeCurrency,
      ),
    ],
    category: "arithmetic",
    id: "money-compare:subtract",
    name: "subtract two USD minor-unit amounts",
    suite: "money-compare",
  },
  {
    adapters: [
      use(
        lib.kern,
        rotating(moneyInputs, ({ left }) => money.multiplyMoney(left, 1.15)),
        safeMinorUnits,
      ),
      use(
        lib.dinero,
        rotating(dineroInputs, ({ left }) =>
          dinero.transformScale(
            dinero.multiply(left, { amount: 115, scale: 2 }),
            2,
            dinero.halfAwayFromZero,
          ),
        ),
        safeDinero,
      ),
      use(
        lib.currency,
        rotating(currencyInputs, ({ left }) => left.multiply(1.15)),
        safeCurrency,
      ),
    ],
    category: "arithmetic",
    id: "money-compare:multiply",
    name: "multiply by 1.15 and round to cents",
    suite: "money-compare",
  },
  {
    adapters: [
      use(lib.kern, () => money.allocateMoney(10_003, ratios), length(8)),
      use(
        lib.dinero,
        () =>
          dinero.allocate(
            dinero.dinero({ amount: 10_003, currency: dinero.USD }),
            ratios.map(() => ({ amount: 1, scale: 0 })),
          ),
        length(8),
      ),
      use(lib.currency, () => currency(10_003, { fromCents: true }).distribute(8), length(8)),
    ],
    category: "allocation",
    id: "money-compare:allocation",
    items: 8,
    name: "allocate equally among eight recipients",
    size: 8,
    suite: "money-compare",
    unit: "recipients",
  },
]

const cachedOnce = {
  kern: async.once((value: number) => value + 1),
  es: es.once((value: number) => value + 1),
  lodash: lodash.once((value: number) => value + 1),
}
cachedOnce.kern(41)
cachedOnce.es(41)
cachedOnce.lodash(41)
const debounced = {
  kern: async.debounce(() => {}, 60_000),
  es: es.debounce(() => {}, 60_000),
  lodash: lodash.debounce(() => {}, 60_000),
}
const asyncCases: readonly Scenario[] = [
  {
    adapters: [
      use(lib.kern, () => cachedOnce.kern(99), equal(42)),
      use(lib.es, () => cachedOnce.es(99), equal(42)),
      use(lib.lodash, () => cachedOnce.lodash(99), equal(42)),
    ],
    category: "once",
    id: "async-control-compare:once-cached",
    name: "invoke cached once result",
    suite: "async-control-compare",
  },
  {
    adapters: [
      use(
        lib.kern,
        () => {
          debounced.kern()
          debounced.kern.cancel()
          return true
        },
        equal(true),
      ),
      use(
        lib.es,
        () => {
          debounced.es()
          debounced.es.cancel()
          return true
        },
        equal(true),
      ),
      use(
        lib.lodash,
        () => {
          debounced.lodash()
          debounced.lodash.cancel()
          return true
        },
        equal(true),
      ),
    ],
    category: "debounce",
    id: "async-control-compare:debounce-cancel",
    iterationCap: 100_000,
    name: "schedule and cancel trailing debounce",
    suite: "async-control-compare",
  },
]
const retryError = new Error("expected retry failure")
const retryEntries = (failures: number): readonly Adapter[] => [
  use(
    lib.kern,
    () =>
      async.retry(
        (attempt) => (attempt <= failures ? Promise.reject(retryError) : Promise.resolve(42)),
        { attempts: failures + 1 },
      ),
    equal(42),
    true,
  ),
  use(
    lib.es,
    () => {
      let attempt = 0
      return es.retry(
        () => (++attempt <= failures ? Promise.reject(retryError) : Promise.resolve(42)),
        { retries: failures },
      )
    },
    equal(42),
    true,
  ),
  use(
    lib.pRetry,
    () => {
      let attempt = 0
      return pRetry(
        () => (++attempt <= failures ? Promise.reject(retryError) : Promise.resolve(42)),
        { factor: 1, minTimeout: 0, retries: failures },
      )
    },
    equal(42),
    true,
  ),
]
const retryCases: readonly Scenario[] = [
  {
    adapters: retryEntries(0),
    category: "retry",
    id: "async-retry-compare:first-attempt",
    iterationCap: 100_000,
    name: "succeed on first attempt",
    suite: "async-retry-compare",
  },
  {
    adapters: retryEntries(2),
    category: "retry",
    id: "async-retry-compare:third-attempt",
    iterationCap: 100_000,
    name: "succeed on third attempt without delay",
    suite: "async-retry-compare",
  },
]

export const moduleComparisonBenchmarks: readonly BenchmarkCase[] = [
  ...arrayCases.flatMap(expand),
  ...objectCases.flatMap(expand),
  ...stringCases.flatMap(expand),
  ...numberCases.flatMap(expand),
  ...dateCases.flatMap(expand),
  ...moneyCases.flatMap(expand),
  ...asyncCases.flatMap(expand),
  ...retryCases.flatMap(expand),
]
