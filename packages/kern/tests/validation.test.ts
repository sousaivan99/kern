import { describe, expect, test } from "bun:test"
import {
  array,
  boolean,
  date,
  enumeration,
  literal,
  number,
  object,
  record,
  string,
  tuple,
  union,
  ValidationError,
} from "../src/validation/index.js"

describe("validation primitives", () => {
  test("parses and transforms fluent strings in chain order", () => {
    const schema = string().trim().min(2).max(4).startsWith("a").endsWith("c")
    expect(schema.parse(" abc ")).toBe("abc")
    const result = schema.safeParse(" a ")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues).toEqual([
        {
          path: [],
          code: "too_small",
          message: "Expected at least 2 characters",
          received: "string",
          details: { minimum: 2 },
        },
      ])
    }
  })

  test("supports formats without mutating caller regular expressions", () => {
    expect(string().email().safeParse("john@example.com").success).toBe(true)
    expect(string().email().safeParse("nope").success).toBe(false)
    expect(string().url().safeParse("https://example.com").success).toBe(true)
    expect(string().url().safeParse("javascript:alert(1)").success).toBe(true)
    expect(string().uuid().safeParse("f47ac10b-58cc-4372-a567-0e02b2c3d479").success).toBe(true)
    expect(string().length(3).safeParse("abc").success).toBe(true)

    const callerPattern = /a/gu
    callerPattern.lastIndex = 9
    expect(string().regex(callerPattern).safeParse("a").success).toBe(true)
    expect(callerPattern.lastIndex).toBe(9)
  })

  test("validates number constraints and reports safe value kinds", () => {
    const schema = number().integer().finite().min(1).max(10).positive()
    expect(schema.parse(4)).toBe(4)
    expect(schema.safeParse(4.5).success).toBe(false)
    expect(number().negative().safeParse(-1).success).toBe(true)
    expect(number().safeParse(Number.POSITIVE_INFINITY).success).toBe(true)
    expect(() => number().min(Number.NaN)).toThrow(RangeError)

    for (const [value, received] of [
      [Number.NaN, "nan"],
      [null, "null"],
      [[], "array"],
      [new Date(), "date"],
    ] as const) {
      const result = number().safeParse(value)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.issues[0]).toMatchObject({ expected: "number", received })
        expect(result.issues[0]).not.toHaveProperty("value")
      }
    }
  })

  test("supports boolean, dates, literals, and enumerations", () => {
    const now = new Date()
    expect(boolean().parse(true)).toBe(true)
    expect(boolean().safeParse("true").success).toBe(false)
    expect(date().parse(now)).toBe(now)
    expect(date().safeParse(new Date(Number.NaN)).success).toBe(false)
    expect(literal(42).parse(42)).toBe(42)
    expect(literal(42).safeParse(41).success).toBe(false)
    expect(enumeration(["draft", "live"] as const).parse("live")).toBe("live")
    expect(enumeration(["draft", "live"] as const).safeParse("other").success).toBe(false)
    expect(() => string().min(-1)).toThrow(RangeError)
  })
})

describe("validation objects and composition", () => {
  const User = object({
    id: number().integer(),
    name: string().trim().min(2),
    role: string().default("member"),
    nickname: string().optional(),
  })

  test("strips unknown keys and handles presence predictably", () => {
    expect(User.parse({ id: 1, name: " Ada ", ignored: true })).toEqual({
      id: 1,
      name: "Ada",
      role: "member",
    })
    expect(User.safeParse(new Date()).success).toBe(false)
    expect(record(number()).safeParse(new Map()).success).toBe(false)

    const presence = object({
      requiredUndefined: literal(undefined),
      transformedUndefined: string().transform(() => undefined),
    })
    const parsed = presence.parse({ requiredUndefined: undefined, transformedUndefined: "x" })
    expect(Object.hasOwn(parsed, "requiredUndefined")).toBe(true)
    expect(Object.hasOwn(parsed, "transformedUndefined")).toBe(true)
  })

  test("composes immutably with pick, omit, extend, and chained policies", () => {
    const Public = User.pick(["id", "name"]).extend({ name: string().min(4), active: boolean() })
    expect(Public.parse({ id: 1, name: "Alan", active: true, extra: 1 })).toEqual({
      id: 1,
      name: "Alan",
      active: true,
    })
    expect(Public.safeParse({ id: 1, name: "Ada", active: true }).success).toBe(false)
    expect(User.parse({ id: 1, name: "Ada" })).toEqual({ id: 1, name: "Ada", role: "member" })
    expect(
      User.omit(["nickname", "role"]).strict().safeParse({ id: 1, name: "Ada", role: "x" }),
    ).toMatchObject({ success: false })
    expect(() => User.pick(["missing"] as never)).toThrow(RangeError)
    expect(() => User.omit(["missing"] as never)).toThrow(RangeError)
  })

  test("partial makes every field optional and suppresses missing defaults", () => {
    expect(User.partial().parse({})).toEqual({})
    expect(User.partial().parse({ role: undefined })).toEqual({})
    expect(User.partial().parse({ role: "admin" })).toEqual({ role: "admin" })
  })

  test("strict reports known fields before unknown keys in deterministic order", () => {
    const result = object({ first: string(), second: number() }).strict().safeParse({
      zeta: true,
      second: "bad",
      alpha: true,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.map((issue) => [issue.code, issue.path])).toEqual([
        ["required", ["first"]],
        ["invalid_type", ["second"]],
        ["unrecognized_key", ["zeta"]],
        ["unrecognized_key", ["alpha"]],
      ])
    }
  })

  test("passthrough retains safe own string keys on null-prototype inputs", () => {
    const input = Object.create(null) as Record<string, unknown>
    Object.defineProperty(input, "name", { enumerable: true, value: "Ada" })
    Object.defineProperty(input, "__proto__", { enumerable: true, value: { polluted: true } })
    const output = object({ name: string() }).passthrough().parse(input)
    expect(output.name).toBe("Ada")
    expect(Object.hasOwn(output, "__proto__")).toBe(true)
    expect(Object.getPrototypeOf(output)).toBe(Object.prototype)
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  test("reports hostile known and passthrough getters at their own paths", () => {
    const known = Object.defineProperty({}, "value", {
      enumerable: true,
      get() {
        throw new Error("secret known failure")
      },
    })
    const knownResult = object({ value: string() }).safeParse(known)
    expect(knownResult).toEqual({
      success: false,
      issues: [
        {
          path: ["value"],
          code: "validation_exception",
          message: "Validation failed unexpectedly",
        },
      ],
    })

    const unknown = Object.defineProperty({ value: "ok" }, "danger", {
      enumerable: true,
      get() {
        throw new Error("secret unknown failure")
      },
    })
    const unknownResult = object({ value: string() }).passthrough().safeParse(unknown)
    expect(unknownResult).toEqual({
      success: false,
      issues: [
        {
          path: ["danger"],
          code: "validation_exception",
          message: "Validation failed unexpectedly",
        },
      ],
    })
    expect(JSON.stringify(unknownResult)).not.toContain("secret")
    expect(object({ value: string() }).parse(unknown)).toEqual({ value: "ok" })
  })
})

describe("validation execution controls and interoperability", () => {
  const InvalidUsers = object({
    users: array(object({ email: string().email(), age: number().min(18) }).strict()),
  }).strict()
  const input = {
    users: [
      { email: "bad", age: 12, extra: true },
      { email: "also-bad", age: 10 },
    ],
    rootExtra: true,
  }

  test("aggregates nested issues by default and shares issue limits", () => {
    const all = InvalidUsers.safeParse(input)
    expect(all.success).toBe(false)
    if (!all.success) expect(all.issues).toHaveLength(6)

    const bounded = InvalidUsers.safeParse(input, { maxIssues: 3 })
    expect(bounded.success).toBe(false)
    if (!bounded.success) expect(bounded.issues).toHaveLength(3)

    const early = InvalidUsers.safeParse(input, { abortEarly: true, maxIssues: 20 })
    expect(early.success).toBe(false)
    if (!early.success) expect(early.issues).toHaveLength(1)
  })

  test("stops nested validation work when the limit is reached", () => {
    let calls = 0
    const counted = string().refine(() => {
      calls += 1
      return false
    })
    array(counted).safeParse(["a", "b", "c"], { maxIssues: 1 })
    expect(calls).toBe(1)
  })

  test("throws RangeError for invalid issue limits, including safeParse", () => {
    for (const maxIssues of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => string().safeParse("x", { maxIssues })).toThrow(RangeError)
      expect(() => string().parse("x", { maxIssues })).toThrow(RangeError)
    }
  })

  test("supports tuples, records, isolated unions, and exact nested paths", () => {
    expect(array(number()).safeParse("not an array").success).toBe(false)
    expect(tuple([string(), number()] as const).parse(["a", 1])).toEqual(["a", 1])
    expect(tuple([string()] as const).safeParse("not an array").success).toBe(false)
    expect(tuple([string()] as const).safeParse([]).success).toBe(false)
    expect(record(number()).parse({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 })
    expect(record(number()).safeParse({ a: "bad", b: "bad" }, { maxIssues: 1 })).toMatchObject({
      success: false,
      issues: [{ path: ["a"] }],
    })
    const hostileRecord = Object.defineProperty({}, "value", {
      enumerable: true,
      get() {
        throw new Error("hostile record")
      },
    })
    expect(record(number()).safeParse(hostileRecord)).toMatchObject({
      success: false,
      issues: [{ path: ["value"], code: "validation_exception" }],
    })
    expect(union([string(), number()] as const).parse(1)).toBe(1)
    const result = union([string().refine(() => false), number()] as const).safeParse(false)
    expect(result).toEqual({
      success: false,
      issues: [
        { path: [], code: "invalid_union", message: "Value did not match any union member" },
      ],
    })
  })

  test("implements synchronous Standard Schema V1", () => {
    const schema = object({ name: string(), age: number().optional() })
    expect(schema["~standard"].version).toBe(1)
    expect(schema["~standard"].vendor).toBe("kern")
    expect(schema["~standard"].validate({ name: "Ada" })).toEqual({ value: { name: "Ada" } })
    const invalid = schema["~standard"].validate({ name: 1 })
    expect(invalid).toMatchObject({ issues: [{ path: ["name"], code: "invalid_type" }] })
    expect(invalid).not.toBeInstanceOf(Promise)
  })

  test("uses ValidationError.issues and never exposes an errors alias", () => {
    try {
      string().parse(1)
      throw new Error("expected parse to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      if (error instanceof ValidationError) {
        expect(error.issues).toHaveLength(1)
        expect(error).not.toHaveProperty("errors")
      }
    }
  })

  test("turns callback exceptions into safe issues without retaining exceptions", () => {
    const transformed = string().transform(() => {
      throw new Error("sensitive transform detail")
    })
    const refined = string().refine(
      () => {
        throw new Error("sensitive refinement detail")
      },
      { code: "not_numeric", message: "Expected numeric text" },
    )
    for (const result of [transformed.safeParse("x"), refined.safeParse("x")]) {
      expect(result).toMatchObject({ success: false, issues: [{ code: "validation_exception" }] })
      expect(JSON.stringify(result)).not.toContain("sensitive")
    }
    expect(string().optional().parse(undefined)).toBeUndefined()
    expect(string().nullable().parse(null)).toBeNull()

    const hostileObject = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("sensitive proxy detail")
        },
      },
    )
    expect(object({}).safeParse(hostileObject)).toEqual({
      success: false,
      issues: [
        { path: [], code: "validation_exception", message: "Validation failed unexpectedly" },
      ],
    })
  })
})
