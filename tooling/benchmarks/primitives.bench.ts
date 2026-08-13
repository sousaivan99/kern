import {
  chunk,
  groupBy,
  partition,
  unique,
  uniqueBy,
  withoutFalsy,
} from "../../packages/kern/src/array/index.js"
import { allocateMoney, roundMoney, sumMoney } from "../../packages/kern/src/money/index.js"
import { deepFreeze, hasOwn, hasOwnPath, omit, pick } from "../../packages/kern/src/object/index.js"
import { camelCase, slugify, truncate } from "../../packages/kern/src/string/index.js"
import { type BenchmarkCase, invariant } from "./harness.js"

const sizes = [1_000, 10_000, 100_000] as const

const assertArrayLength = (result: unknown, expected: number, name: string): void => {
  invariant(Array.isArray(result), `${name} must return an array`)
  invariant(result.length === expected, `${name} must return ${expected} values`)
}

const makeFlatObject = (size: number): Record<string, number> => {
  const output: Record<string, number> = {}
  for (let index = 0; index < size; index += 1) output[`key${index}`] = index
  return output
}

const arrayBenchmarks = sizes.flatMap((size): BenchmarkCase[] => {
  const halfSize = Math.ceil(size / 2)
  const numbers = Array.from({ length: size }, (_, index) => index % halfSize)
  const objects = numbers.map((identity) => ({ identity }))
  const mixed = numbers.map((value, index) => (index % 4 === 0 ? 0 : value + 1))
  return [
    {
      name: "array unique (50% distinct)",
      run: () => unique(numbers),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => assertArrayLength(result, halfSize, "unique"),
    },
    {
      name: "array uniqueBy (50% distinct)",
      run: () => uniqueBy(objects, (value) => value.identity),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => assertArrayLength(result, halfSize, "uniqueBy"),
    },
    {
      name: "array groupBy (100 groups)",
      run: () => groupBy(numbers, (value) => value % 100),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => {
        invariant(typeof result === "object" && result !== null, "groupBy must return an object")
        invariant(Object.keys(result).length === Math.min(size, 100), "groupBy group count")
      },
    },
    {
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
      name: "array chunk (size 100)",
      run: () => chunk(numbers, 100),
      size,
      suite: "primitives",
      unit: "items",
      verify: (result) => assertArrayLength(result, Math.ceil(size / 100), "chunk"),
    },
    {
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

const boundaryValues = Array.from({ length: 100_000 }, (_, index) => index)
const pathValue = { level1: { level2: { level3: { level4: { value: true } } } } }

const scalarBenchmarks = sizes.flatMap((size): BenchmarkCase[] => {
  const moneyValues = Array.from({ length: size }, () => 1)
  const allocationRatios = Array.from({ length: size }, () => 1)
  const stringValue = "Crème Brûlée HTTPResponse42 ".repeat(Math.ceil(size / 28)).slice(0, size)
  return [
    {
      name: "money sumMoney",
      run: () => sumMoney(moneyValues),
      size,
      suite: "primitives",
      unit: "amounts",
      verify: (result) => invariant(result === size, "sumMoney must total every amount"),
    },
    {
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
      name: "string camelCase",
      run: () => camelCase(stringValue),
      size,
      suite: "primitives",
      unit: "UTF-16 code units",
      verify: (result) =>
        invariant(typeof result === "string" && result.length > 0, "camelCase output"),
    },
    {
      name: "string slugify",
      run: () => slugify(stringValue),
      size,
      suite: "primitives",
      unit: "UTF-16 code units",
      verify: (result) =>
        invariant(typeof result === "string" && result.length > 0, "slugify output"),
    },
    {
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
  ...scalarBenchmarks,
]
