import { describe, expect, test } from "bun:test"
import {
  canonicalPath,
  createRoot,
  FormPathError,
  getPath,
  immutable,
  parsePath,
  replacePath,
  setPath,
} from "../src/path.js"
import { signal } from "../src/signal.js"

describe("form paths", () => {
  test("parses and canonicalizes nested, indexed, and literal names", () => {
    expect(parsePath("user.email")).toEqual(["user", "email"])
    expect(parsePath("users[0].email")).toEqual(["users", 0, "email"])
    expect(parsePath("[literal.dotted.name]")).toEqual(["literal.dotted.name"])
    expect(parsePath('user["literal.dotted.name"]')).toEqual(["user", "literal.dotted.name"])
    expect(parsePath('user["closing]bracket"]')).toEqual(["user", "closing]bracket"])
    expect(parsePath(String.raw`user["quoted\"name"]`)).toEqual(["user", 'quoted"name'])
    expect(canonicalPath(["user", "literal.dotted.name", 2])).toBe('user["literal.dotted.name"][2]')
  })

  test("constructs null-prototype records without prototype writes", () => {
    const accountPath = parsePath("account.name")
    const prototypePath = parsePath('["__proto__"]')
    const paths = [accountPath, prototypePath]
    const root = createRoot(paths)
    setPath(root, accountPath, "Ada")
    setPath(root, prototypePath, "safe")
    expect(Object.getPrototypeOf(root)).toBeNull()
    expect(getPath(root, ["account", "name"])).toBe("Ada")
    expect(getPath(root, ["__proto__"])).toBe("safe")
    expect(Reflect.get(Object.prototype, "polluted")).toBeUndefined()
  })

  test("rejects malformed, abusive, and conflicting paths", () => {
    expect(() => parsePath("user..email")).toThrow(FormPathError)
    expect(() => parsePath("users[10001]")).toThrow(FormPathError)
    expect(() => parsePath(`${"a.".repeat(32)}a`)).toThrow(FormPathError)
    const root = createRoot([["user"]])
    setPath(root, ["user"], "value")
    expect(() => setPath(root, ["user", "email"], "value")).toThrow(FormPathError)
  })

  test("replaces one immutable path while retaining unrelated branches", () => {
    const root = Object.create(null) as Record<string, unknown>
    const profile = Object.create(null) as Record<string, unknown>
    profile.email = "before@example.com"
    profile.roles = ["admin"]
    root.profile = profile
    root.settings = Object.freeze({ locale: "en" })
    const frozen = immutable(root)

    const next = replacePath(frozen, ["profile", "email"], "after@example.com")

    expect(getPath(next, ["profile", "email"])).toBe("after@example.com")
    expect(Reflect.get(next, "settings")).toBe(Reflect.get(frozen, "settings"))
    expect(Reflect.get(next, "profile")).not.toBe(Reflect.get(frozen, "profile"))
    expect(Object.getPrototypeOf(next)).toBeNull()
    expect(Object.isFrozen(next)).toBeTrue()
    expect(() => replacePath(frozen, ["missing"], "value")).toThrow(FormPathError)
  })
})

describe("form signals", () => {
  test("publishes current values and cleans up subscriptions", () => {
    const value = signal(1)
    const seen: number[] = []
    const unsubscribe = value.subscribe((next) => seen.push(next))
    value.set(2)
    value.set(2)
    unsubscribe()
    value.set(3)
    expect(value.value).toBe(3)
    expect(seen).toEqual([2])
  })
})
