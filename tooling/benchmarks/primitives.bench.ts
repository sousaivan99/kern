import {
  chunk,
  groupBy,
  partition,
  unique,
  uniqueBy,
  withoutFalsy,
} from "../../packages/kern/src/array/index.js"
import { formatDate } from "../../packages/kern/src/date/index.js"
import {
  allocateMoney,
  formatMoney,
  parseMoney,
  roundMoney,
  sumMoney,
} from "../../packages/kern/src/money/index.js"
import { formatNumber } from "../../packages/kern/src/number/index.js"
import { deepFreeze, hasOwn, hasOwnPath, omit, pick } from "../../packages/kern/src/object/index.js"
import { camelCase, slugify, truncate } from "../../packages/kern/src/string/index.js"
import { type BenchmarkCase, invariant } from "./harness.js"

const sizes = [1_000, 10_000, 100_000] as const
const arraySizes = [1, 10, ...sizes] as const

const assertArrayLength = (result: unknown, expected: number, name: string): void => {
  invariant(Array.isArray(result), `${name} must return an array`)
  invariant(result.length === expected, `${name} must return ${expected} values`)
}

const makeFlatObject = (size: number): Record<string, number> => {
  const output: Record<string, number> = {}
  for (let index = 0; index < size; index += 1) output[`key${index}`] = index
  return output
}

const arrayBenchmarks = arraySizes.flatMap((size): BenchmarkCase[] => {
  const halfSize = Math.ceil(size / 2)
  const numbers = Array.from({ length: size }, (_, index) => index % halfSize)
  const objects = numbers.map((identity) => ({ identity }))
  const mixed = numbers.map((value, index) => (index % 4 === 0 ? 0 : value + 1))
  return [
    {
      itemsPerOperation: size,
      name: "array unique (50% distinct)",
      run: () => unique(numbers),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => assertArrayLength(result, halfSize, "unique"),
    },
    {
      itemsPerOperation: size,
      name: "array uniqueBy (50% distinct)",
      run: () => uniqueBy(objects, (value) => value.identity),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => assertArrayLength(result, halfSize, "uniqueBy"),
    },
    {
      itemsPerOperation: size,
      name: "array groupBy (100 groups)",
      run: () => groupBy(numbers, (value) => value % 100),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => {
        invariant(typeof result === "object" && result !== null, "groupBy must return an object")
        invariant(Object.keys(result).length === Math.min(halfSize, 100), "groupBy group count")
      },
    },
    {
      itemsPerOperation: size,
      name: "array partition (even/odd)",
      run: () => partition(numbers, (value) => value % 2 === 0),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => {
        invariant(Array.isArray(result) && result.length === 2, "partition must return two arrays")
        if (!Array.isArray(result)) return
        const matching = result[0]
        const remaining = result[1]
        invariant(Array.isArray(matching) && Array.isArray(remaining), "partition output arrays")
        invariant(matching.length + remaining.length === size, "partition must retain every value")
      },
    },
    {
      itemsPerOperation: size,
      name: "array chunk (size 100)",
      run: () => chunk(numbers, 100),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => assertArrayLength(result, Math.ceil(size / 100), "chunk"),
    },
    {
      itemsPerOperation: size,
      name: "array withoutFalsy (25% falsy)",
      run: () => withoutFalsy(mixed),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => assertArrayLength(result, size - Math.ceil(size / 4), "withoutFalsy"),
    },
  ]
})

const objectBenchmarks = sizes.flatMap((size): BenchmarkCase[] => {
  const source = makeFlatObject(size)
  const selectedKeys = Array.from({ length: Math.min(size, 100) }, (_, index) => `key${index}`)
  return [
    {
      name: "object pick (100 keys)",
      itemsPerOperation: selectedKeys.length,
      run: () => pick(source, selectedKeys),
      size,
      suite: "primitives",
      unit: "selected keys",
      verify: (result) => {
        invariant(typeof result === "object" && result !== null, "pick must return an object")
        invariant(Reflect.ownKeys(result).length === selectedKeys.length, "pick key count")
      },
    },
    {
      itemsPerOperation: size,
      name: "object omit (100 keys)",
      run: () => omit(source, selectedKeys),
      size,
      suite: "primitives",
      unit: "source keys",
      verify: (result) => {
        invariant(typeof result === "object" && result !== null, "omit must return an object")
        invariant(Reflect.ownKeys(result).length === size - selectedKeys.length, "omit key count")
      },
    },
    {
      itemsPerOperation: size,
      iterationCap: 2_048,
      name: "object deepFreeze (flat)",
      prepareBatch: (iterations) => {
        const fixtures = Array.from({ length: iterations }, () => makeFlatObject(size))
        let index = 0
        return () => deepFreeze(fixtures[index++] as Record<string, number>)
      },
      run: () => deepFreeze(makeFlatObject(size)),
      size,
      suite: "primitives",
      unit: "properties",
      verify: (result) => invariant(Object.isFrozen(result), "deepFreeze must freeze its input"),
    },
  ]
})

const makeNestedGraph = (): Record<string, unknown> => {
  const root: Record<string, unknown> = { value: 0 }
  let current = root
  for (let depth = 1; depth <= 8; depth += 1) {
    const child: Record<string, unknown> = { value: depth }
    current.child = child
    current = child
  }
  return root
}

const makeCyclicGraph = (): Record<string, unknown> => {
  const root: Record<string, unknown> = { value: 1 }
  const child: Record<string, unknown> = { parent: root, value: 2 }
  root.child = child
  return root
}

const mutableFreezeBenchmarks: readonly BenchmarkCase[] = [
  {
    iterationCap: 2_048,
    name: "object deepFreeze (nested depth 8)",
    prepareBatch: (iterations) => {
      const fixtures = Array.from({ length: iterations }, makeNestedGraph)
      let index = 0
      return () => deepFreeze(fixtures[index++] as Record<string, unknown>)
    },
    run: () => deepFreeze(makeNestedGraph()),
    size: 9,
    suite: "primitives",
    unit: "objects",
    verify: (result) => invariant(Object.isFrozen(result), "nested graph root must be frozen"),
  },
  {
    iterationCap: 2_048,
    name: "object deepFreeze (cyclic pair)",
    prepareBatch: (iterations) => {
      const fixtures = Array.from({ length: iterations }, makeCyclicGraph)
      let index = 0
      return () => deepFreeze(fixtures[index++] as Record<string, unknown>)
    },
    run: () => deepFreeze(makeCyclicGraph()),
    size: 2,
    suite: "primitives",
    unit: "objects",
    verify: (result) => invariant(Object.isFrozen(result), "cyclic graph root must be frozen"),
  },
]

const boundaryValues = Array.from({ length: 100_000 }, (_, index) => index)
const pathValue = { level1: { level2: { level3: { level4: { value: true } } } } }
const intlBoundaryLocales = Array.from({ length: 33 }, (_, index) => `en-US-x-k${index}`)
const intlChurnLocales = Array.from({ length: 128 }, (_, index) => `en-US-x-k${index}`)
let intlBoundaryIndex = 0
let intlChurnIndex = 0

const scalarBenchmarks = sizes.flatMap((size): BenchmarkCase[] => {
  const moneyValues = Array.from({ length: size }, () => 1)
  const allocationRatios = Array.from({ length: size }, () => 1)
  const stringValue = "Crème Brûlée HTTPResponse42 ".repeat(Math.ceil(size / 28)).slice(0, size)
  return [
    {
      itemsPerOperation: size,
      name: "money sumMoney",
      run: () => sumMoney(moneyValues),
      size,
      suite: "primitives",
      unit: "amounts",
      verify: (result) => invariant(result === size, "sumMoney must total every amount"),
    },
    {
      itemsPerOperation: size,
      name: "money allocateMoney",
      run: () => allocateMoney(size, allocationRatios),
      size,
      suite: "primitives",
      unit: "recipients",
      verify: (result) => {
        assertArrayLength(result, size, "allocateMoney")
        if (Array.isArray(result)) {
          invariant(
            result.reduce((total, value) => total + Number(value), 0) === size,
            "allocation total",
          )
        }
      },
    },
    {
      itemsPerOperation: size,
      name: "string camelCase",
      run: () => camelCase(stringValue),
      size,
      suite: "primitives",
      unit: "UTF-16 code units",
      verify: (result) =>
        invariant(typeof result === "string" && result.length > 0, "camelCase output"),
    },
    {
      itemsPerOperation: size,
      name: "string slugify",
      run: () => slugify(stringValue),
      size,
      suite: "primitives",
      unit: "UTF-16 code units",
      verify: (result) =>
        invariant(typeof result === "string" && result.length > 0, "slugify output"),
    },
    {
      itemsPerOperation: size,
      name: "string grapheme truncate (50%)",
      run: () => truncate(stringValue, Math.floor(size / 2)),
      size,
      suite: "primitives",
      unit: "UTF-16 code units",
      verify: (result) => {
        invariant(typeof result === "string", "truncate must return a string")
        invariant([...result].length === Math.floor(size / 2), "truncate output length")
      },
    },
  ]
})

export const primitiveBenchmarks: readonly BenchmarkCase[] = [
  ...arrayBenchmarks,
  {
    name: "money roundMoney (cash increment)",
    run: () => roundMoney(10_237, { roundingIncrement: 5, roundingMode: "halfEven" }),
    suite: "primitives",
    verify: (result) => invariant(result === 10_235, "roundMoney cash increment"),
  },
  {
    name: "object hasOwn (100K input)",
    run: () => hasOwn(boundaryValues, 99_999),
    suite: "primitives",
    verify: (result) => invariant(result === true, "hasOwn must find the final index"),
  },
  {
    name: "object hasOwnPath (depth 5)",
    run: () => hasOwnPath(pathValue, "level1.level2.level3.level4.value"),
    size: 5,
    suite: "primitives",
    unit: "path segments",
    verify: (result) => invariant(result === true, "hasOwnPath must find the nested value"),
  },
  ...objectBenchmarks,
  ...mutableFreezeBenchmarks,
  ...scalarBenchmarks,
  {
    name: "money allocateMoney (remainder-heavy)",
    run: () => allocateMoney(10_003, [1, 2, 3, 5, 8, 13, 21, 34]),
    size: 8,
    suite: "primitives",
    unit: "recipients",
    verify: (result) => {
      assertArrayLength(result, 8, "remainder allocation")
      invariant(
        Array.isArray(result) &&
          result.reduce((total, value) => total + Number(value), 0) === 10_003,
        "remainder allocation total",
      )
    },
  },
  {
    name: "string camelCase (short realistic)",
    run: () => camelCase("Crème Brûlée HTTPResponse42"),
    size: 27,
    suite: "primitives",
    unit: "UTF-16 code units",
    verify: (result) => invariant(result === "crèmeBrûléeHttpResponse42", "short camelCase"),
  },
  {
    name: "string truncate (non-truncating)",
    run: () => truncate("Crème Brûlée", 32),
    size: 12,
    suite: "primitives",
    unit: "UTF-16 code units",
    verify: (result) => invariant(result === "Crème Brûlée", "non-truncating result"),
  },
  {
    name: "Intl NumberFormat repeated configuration",
    run: () => formatNumber(1_234_567.89, { locale: "de-DE", maximumFractionDigits: 2 }),
    suite: "primitives",
    verify: (result) => invariant(result === "1.234.567,89", "number format result"),
  },
  {
    name: "Intl DateTimeFormat repeated explicit zone",
    run: () =>
      formatDate(new Date("2025-01-02T12:00:00Z"), {
        day: "numeric",
        locale: "en-US",
        month: "short",
        timeZone: "UTC",
        year: "numeric",
      }),
    suite: "primitives",
    verify: (result) => invariant(result === "Jan 2, 2025", "date format result"),
  },
  {
    name: "Intl NumberFormat 33-key cache boundary",
    run: () => {
      const locale = intlBoundaryLocales[intlBoundaryIndex++ % intlBoundaryLocales.length]
      return formatNumber(1_234.5, { locale, maximumFractionDigits: 1 })
    },
    size: 33,
    suite: "primitives",
    unit: "configurations",
    verify: (result) => invariant(result === "1,234.5", "number boundary result"),
  },
  {
    name: "Intl NumberFormat 128-key churn",
    run: () => {
      const locale = intlChurnLocales[intlChurnIndex++ % intlChurnLocales.length]
      return formatNumber(1_234.5, { locale, maximumFractionDigits: 1 })
    },
    size: 128,
    suite: "primitives",
    unit: "configurations",
    verify: (result) => invariant(result === "1,234.5", "number churn result"),
  },
  {
    name: "Intl DateTimeFormat 128-key churn",
    run: () => {
      const locale = intlChurnLocales[intlChurnIndex++ % intlChurnLocales.length]
      return formatDate(new Date("2025-01-02T12:00:00Z"), {
        day: "numeric",
        locale,
        month: "short",
        timeZone: "UTC",
        year: "numeric",
      })
    },
    size: 128,
    suite: "primitives",
    unit: "configurations",
    verify: (result) => invariant(result === "Jan 2, 2025", "date churn result"),
  },
  {
    name: "Intl money format repeated configuration",
    run: () => formatMoney(1099, "EUR", { locale: "de-DE" }),
    suite: "primitives",
    verify: (result) => invariant(result === "10,99 €", "money format result"),
  },
  {
    name: "Intl money parse repeated configuration",
    run: () => parseMoney("10,99 €", "EUR", { locale: "de-DE" }),
    suite: "primitives",
    verify: (result) => invariant(result === 1099, "money parse result"),
  },
]
