import { describe, expect, test } from "bun:test"
import {
  camelCase,
  capitalize,
  isBlank,
  kebabCase,
  slugify,
  snakeCase,
  truncate,
  uncapitalize,
} from "../src/string/index.js"

describe("string", () => {
  test("changes word casing", () => {
    expect(capitalize("hello")).toBe("Hello")
    expect(uncapitalize("Hello")).toBe("hello")
    expect(capitalize("𐐨ello")).toBe("𐐀ello")
    expect(uncapitalize("𐐀ello")).toBe("𐐨ello")
    expect(camelCase("HTTP response-code")).toBe("httpResponseCode")
    expect(camelCase("𐐨ELLO world")).toBe("𐐨ElloWorld")
    expect(kebabCase("helloWorld value")).toBe("hello-world-value")
    expect(snakeCase("helloWorld value")).toBe("hello_world_value")
  })

  test("uses deterministic casing unless a locale is explicit", () => {
    expect(capitalize("istanbul")).toBe("Istanbul")
    expect(capitalize("istanbul", { locale: "tr" })).toBe("İstanbul")
    expect(uncapitalize("Istanbul")).toBe("istanbul")
    expect(uncapitalize("Istanbul", { locale: "tr" })).toBe("ıstanbul")
    expect(slugify("IĞDIR", { locale: "tr" })).toBe("ıgdır")
  })

  test("truncates by grapheme cluster without splitting user-perceived characters", () => {
    expect(truncate("hello world", 6)).toBe("hello…")
    expect(truncate("😀😀😀", 2)).toBe("😀…")
    expect(truncate("e\u0301e\u0301e", 2)).toBe("e\u0301…")
    expect(truncate("👨‍👩‍👧‍👦ab", 2)).toBe("👨‍👩‍👧‍👦…")
    expect(truncate("🇱🇺🇫🇷x", 2)).toBe("🇱🇺…")
    expect(truncate("hello", 1, "👩‍💻")).toBe("👩‍💻")
    expect(truncate("😀", 1, "e\u0301")).toBe("😀")
    expect(truncate("line\r\nline", 6, "...")).toBe("lin...")
    expect(truncate("hello", 0)).toBe("")
    expect(truncate("hello", 10)).toBe("hello")
    expect(() => truncate("hello", -1)).toThrow(RangeError)
  })

  test("slugifies common Unicode text and identifies blanks", () => {
    expect(slugify("Crème brûlée! À la carte")).toBe("creme-brulee-a-la-carte")
    expect(isBlank(" \n\t ")).toBe(true)
    expect(isBlank(" value ")).toBe(false)
  })
})
