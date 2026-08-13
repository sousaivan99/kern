import { describe, expect, test } from "bun:test"
import { deepFreeze, hasOwnPath, omit, pick } from "../src/object/index.js"

describe("object", () => {
  test("picks and omits own properties", () => {
    const symbol = Symbol("key")
    const value = { a: 1, b: 2, [symbol]: 3 }
    expect(pick(value, ["a", symbol])).toEqual({ a: 1, [symbol]: 3 })
    expect(omit(value, ["b"])).toEqual({ a: 1, [symbol]: 3 })

    const nullPrototype = Object.assign(Object.create(null), { a: 1, b: 2 }) as {
      a: number
      b: number
    }
    expect(Object.getPrototypeOf(pick(nullPrototype, ["a"]))).toBeNull()

    class Account {
      id = "account"
      describe(): string {
        return this.id
      }
    }
    expect(() => omit(new Account(), [])).toThrow(TypeError)
  })

  test("reads safe nested own-property paths", () => {
    const value = { user: { contacts: [{ email: "a@example.com" }] } }
    expect(hasOwnPath(value, ["user", "contacts", 0, "email"])).toBe(true)
    expect(hasOwnPath(value, "user.contacts")).toBe(true)
    expect(hasOwnPath(value, "user.missing")).toBe(false)
    expect(hasOwnPath({}, "constructor.prototype")).toBe(false)
    expect(hasOwnPath(Object.create({ inherited: true }), "inherited")).toBe(false)
  })

  test("deep-freezes object graphs including cycles", () => {
    const value: { nested: { count: number }; self?: unknown } = { nested: { count: 1 } }
    value.self = value
    const frozen = deepFreeze(value)
    expect(Object.isFrozen(frozen)).toBe(true)
    expect(Object.isFrozen(frozen.nested)).toBe(true)
    expect(() => {
      value.nested.count = 2
    }).toThrow()
  })

  test("rejects unsupported graphs atomically", () => {
    const nested = { safe: { value: 1 }, unsafe: new Map([["key", "value"]]) }
    expect(() => deepFreeze(nested as unknown)).toThrow(TypeError)
    expect(Object.isFrozen(nested)).toBe(false)
    expect(Object.isFrozen(nested.safe)).toBe(false)

    const accessor = { safe: { value: 1 } }
    Object.defineProperty(accessor, "computed", { get: () => 2 })
    expect(() => deepFreeze(accessor as unknown)).toThrow(TypeError)
    expect(Object.isFrozen(accessor)).toBe(false)

    expect(() => deepFreeze(new Date() as unknown)).toThrow(TypeError)
    expect(() => deepFreeze((() => undefined) as unknown)).toThrow(TypeError)
  })
})
