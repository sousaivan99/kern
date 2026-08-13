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
    expect(camelCase("HTTP response-code")).toBe("httpResponseCode")
    expect(kebabCase("helloWorld value")).toBe("hello-world-value")
    expect(snakeCase("helloWorld value")).toBe("hello_world_value")
  })

  test("truncates by Unicode code point", () => {
    expect(truncate("hello world", 6)).toBe("hello…")
    expect(truncate("😀😀😀", 2)).toBe("😀…")
    expect(truncate("hello", 10)).toBe("hello")
    expect(() => truncate("hello", -1)).toThrow(RangeError)
  })

  test("slugifies common Unicode text and identifies blanks", () => {
    expect(slugify("Crème brûlée! À la carte")).toBe("creme-brulee-a-la-carte")
    expect(isBlank(" \n\t ")).toBe(true)
    expect(isBlank(" value ")).toBe(false)
  })
})
