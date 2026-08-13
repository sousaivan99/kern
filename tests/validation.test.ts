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
  test("parses and transforms strings in chain order", () => {
    const schema = string().trim().min(2).max(4).startsWith("a").endsWith("c")
    expect(schema.parse(" abc ")).toBe("abc")
    expect(schema.safeParse(" a ")).toEqual({
      success: false,
      errors: [{ path: [], code: "too_small", message: "Expected at least 2 characters" }],
    })
  })

  test("supports string formats and patterns", () => {
    expect(string().email().safeParse("john@example.com").success).toBe(true)
    expect(string().email().safeParse("nope")).toEqual({
      success: false,
      errors: [{ path: [], code: "invalid_email", message: "Invalid email address" }],
    })
    expect(string().url().safeParse("https://example.com").success).toBe(true)
    expect(string().url().safeParse("javascript:alert(1)").success).toBe(true)
    expect(string().uuid().safeParse("f47ac10b-58cc-4372-a567-0e02b2c3d479").success).toBe(true)
    expect(string().regex(/^a+$/gu).safeParse("aaa").success).toBe(true)
    expect(string().length(3).safeParse("abc").success).toBe(true)

    const callerPattern = /a/gu
    callerPattern.lastIndex = 9
    const patternSchema = string().regex(callerPattern)
    expect(patternSchema.safeParse("a").success).toBe(true)
    expect(callerPattern.lastIndex).toBe(9)
  })

  test("validates number constraints", () => {
    const schema = number().integer().finite().min(1).max(10).positive()
    expect(schema.parse(4)).toBe(4)
    expect(schema.safeParse(4.5).success).toBe(false)
    expect(number().negative().safeParse(-1).success).toBe(true)
    expect(number().safeParse(Number.NaN).success).toBe(false)
    expect(number().safeParse(Number.POSITIVE_INFINITY).success).toBe(true)
    expect(() => number().min(Number.NaN)).toThrow(RangeError)
  })

  test("supports boolean, date, literal, and enum schemas", () => {
    const now = new Date()
    expect(boolean().parse(true)).toBe(true)
    expect(boolean().safeParse("true").success).toBe(false)
    expect(date().parse(now)).toBe(now)
    expect(date().safeParse(new Date(Number.NaN)).success).toBe(false)
    expect(literal(42).parse(42)).toBe(42)
    expect(enumeration(["draft", "live"] as const).parse("live")).toBe("live")
    expect(enumeration(["draft", "live"] as const).safeParse("other").success).toBe(false)
  })
})

describe("validation collections", () => {
  test("parses objects and strips unknown keys", () => {
    const user = object({
      name: string().trim().min(2),
      email: string().email(),
      age: number().integer().min(18),
    })
    expect(user.parse({ name: " Ada ", email: "ada@example.com", age: 36, ignored: true })).toEqual(
      {
        name: "Ada",
        email: "ada@example.com",
        age: 36,
      },
    )
    expect(user.safeParse(new Date()).success).toBe(false)
    expect(record(number()).safeParse(new Map()).success).toBe(false)
  })

  test("distinguishes required, optional, defaulted, and undefined-valued fields", () => {
    const schema = object({
      defaulted: string().optional().default("fallback"),
      optional: string().optional(),
      requiredUndefined: literal(undefined),
      transformedUndefined: string().transform(() => undefined),
    })
    const parsed = schema.parse({ requiredUndefined: undefined, transformedUndefined: "value" })
    expect(parsed).toEqual({
      defaulted: "fallback",
      requiredUndefined: undefined,
      transformedUndefined: undefined,
    })
    expect(Object.hasOwn(parsed, "requiredUndefined")).toBe(true)
    expect(Object.hasOwn(parsed, "transformedUndefined")).toBe(true)
    expect(schema.safeParse({ transformedUndefined: "value" })).toEqual({
      success: false,
      errors: [{ path: ["requiredUndefined"], code: "required", message: "Required property" }],
    })
    expect(
      string()
        .transform(() => undefined as string | undefined)
        .default("fallback")
        .parse("x"),
    ).toBe("fallback")
  })

  test("collects accurate nested paths", () => {
    const schema = object({
      users: array(object({ email: string().email(), age: number().min(18) })),
    })
    const result = schema.safeParse({ users: [{ email: "bad", age: 12 }] })
    expect(result).toEqual({
      success: false,
      errors: [
        { path: ["users", 0, "email"], code: "invalid_email", message: "Invalid email address" },
        {
          path: ["users", 0, "age"],
          code: "too_small",
          message: "Expected a number greater than or equal to 18",
        },
      ],
    })
  })

  test("supports arrays, tuples, records, and unions", () => {
    expect(array(number()).parse([1, 2, 3])).toEqual([1, 2, 3])
    expect(tuple([string(), number()] as const).parse(["a", 1])).toEqual(["a", 1])
    expect(tuple([string(), number()] as const).safeParse(["a"]).success).toBe(false)
    expect(record(number()).parse({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 })
    expect(union([string(), number()] as const).parse(1)).toBe(1)
    expect(union([string(), number()] as const).safeParse(false)).toEqual({
      success: false,
      errors: [
        { path: [], code: "invalid_union", message: "Value did not match any union member" },
      ],
    })
  })
})

describe("validation modifiers", () => {
  test("supports optional, nullable, and defaults", () => {
    const schema = object({
      nickname: string().optional(),
      bio: string().nullable(),
      role: string().default("member"),
    })
    expect(schema.parse({ bio: null })).toEqual({ bio: null, role: "member" })
    expect(schema.parse({ nickname: undefined, bio: "hello" })).toEqual({
      bio: "hello",
      role: "member",
    })
    expect(() =>
      string()
        .optional()
        .default(undefined as never),
    ).toThrow(TypeError)
  })

  test("supports transformations and refinements", () => {
    const schema = string()
      .transform((value) => Number(value))
      .refine((value) => Number.isFinite(value), {
        code: "not_numeric",
        message: "Expected numeric text",
      })
    expect(schema.parse("42")).toBe(42)
    expect(schema.safeParse("nope")).toEqual({
      success: false,
      errors: [{ path: [], code: "not_numeric", message: "Expected numeric text" }],
    })
  })

  test("turns callback failures into validation failures", () => {
    const transformed = string().transform(() => {
      throw new Error("boom")
    })
    expect(transformed.safeParse("value")).toEqual({
      success: false,
      errors: [{ path: [], code: "transform_error", message: "Transformation failed" }],
    })
  })

  test("parse throws ValidationError while safeParse does not", () => {
    expect(() => string().parse(1)).toThrow(ValidationError)
    const hostile = new Proxy(
      { value: "present" },
      {
        get: () => {
          throw new Error("hostile getter")
        },
      },
    )
    expect(object({ value: string() }).safeParse(hostile)).toEqual({
      success: false,
      errors: [
        { path: [], code: "validation_exception", message: "Validation could not be completed" },
      ],
    })
  })
})
