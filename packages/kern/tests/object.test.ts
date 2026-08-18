import { describe, expect, test } from "bun:test"
import { deepFreeze, hasOwn, hasOwnPath, omit, pick } from "../src/object/index.js"

describe("object", () => {
  test("checks own properties without throwing for untrusted values", () => {
    const symbol = Symbol("key")
    const inherited = Object.create({ inherited: true }) as {
      inherited: boolean
      own?: boolean
      [symbol]?: boolean
    }
    inherited.own = true
    inherited[symbol] = true

    expect(hasOwn(inherited, "own")).toBe(true)
    expect(hasOwn(inherited, symbol)).toBe(true)
    expect(hasOwn(inherited, "inherited")).toBe(false)
    expect(hasOwn(null, "key")).toBe(false)
    expect(hasOwn("value", "length")).toBe(false)
  })

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

  test("copies descriptors without consulting inherited setters", () => {
    const symbol = Symbol("hidden")
    const source = Object.create(null) as Record<PropertyKey, unknown>
    Object.defineProperty(source, "readonly", {
      configurable: false,
      enumerable: false,
      value: 1,
      writable: false,
    })
    Object.defineProperty(source, "__proto__", {
      configurable: true,
      enumerable: true,
      value: "safe",
      writable: true,
    })
    Object.defineProperty(source, symbol, {
      configurable: true,
      enumerable: true,
      value: 2,
      writable: true,
    })

    let getterCalls = 0
    Object.defineProperty(source, "computed", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1
        return 3
      },
    })

    const inheritedKey = "__kernHostileSetter__"
    Object.defineProperty(Object.prototype, inheritedKey, {
      configurable: true,
      set() {
        throw new Error("inherited setter was invoked")
      },
    })
    Object.defineProperty(source, inheritedKey, {
      configurable: true,
      enumerable: true,
      value: 4,
      writable: true,
    })

    try {
      const selected = pick(source, ["readonly", "__proto__", "computed", inheritedKey, symbol])
      const remaining = omit(source, ["readonly"])
      expect(getterCalls).toBe(0)
      expect(Object.getOwnPropertyDescriptor(selected, "readonly")).toEqual({
        configurable: false,
        enumerable: false,
        value: 1,
        writable: false,
      })
      expect(Object.getOwnPropertyDescriptor(selected, "__proto__")?.value).toBe("safe")
      expect(Object.getOwnPropertyDescriptor(selected, "computed")?.get).toBeTypeOf("function")
      expect(Object.getOwnPropertyDescriptor(selected, inheritedKey)?.value).toBe(4)
      expect(Object.getOwnPropertyDescriptor(remaining, symbol)?.value).toBe(2)
    } finally {
      Reflect.deleteProperty(Object.prototype, inheritedKey)
    }
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
