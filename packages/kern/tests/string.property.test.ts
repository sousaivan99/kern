import { expect, test } from "bun:test"
import {
  camelCase,
  capitalize,
  kebabCase,
  slugify,
  snakeCase,
  truncate,
  uncapitalize,
} from "../src/string/index.js"
import { checkProperty } from "./support/property.js"

const tokens = [
  "a",
  "Z",
  "e\u0301",
  "ß",
  "İ",
  "ı",
  "Σ",
  "ς",
  "😀",
  "👩🏽",
  "👨‍👩‍👧‍👦",
  "🇱🇺",
  "中文",
  "日本語",
  "-",
  "_",
  " ",
] as const
const omissions = ["", "…", "👩‍💻", "e\u0301"] as const
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
const graphemes = (value: string): string[] =>
  Array.from(segmenter.segment(value), (part) => part.segment)

test("property: Unicode helpers preserve graphemes and normalization contracts", () => {
  checkProperty(
    "Unicode string helpers",
    (random) => {
      const parts = Array.from({ length: random.integer(0, 12) }, () => random.pick(tokens))
      const value = parts.join("")
      return {
        maximumLength: random.integer(0, graphemes(value).length + 3),
        omission: random.pick(omissions),
        value,
      }
    },
    ({ maximumLength, omission, value }) => {
      const inputGraphemes = graphemes(value)
      const omissionGraphemes = graphemes(omission)
      const output = truncate(value, maximumLength, omission)
      const outputGraphemes = graphemes(output)
      expect(outputGraphemes.length).toBeLessThanOrEqual(maximumLength)

      const expected =
        maximumLength === 0
          ? ""
          : inputGraphemes.length <= maximumLength
            ? value
            : omissionGraphemes.length >= maximumLength
              ? omissionGraphemes.slice(0, maximumLength).join("")
              : `${inputGraphemes.slice(0, maximumLength - omissionGraphemes.length).join("")}${omission}`
      expect(output).toBe(expected)

      expect(kebabCase(value)).toBe(kebabCase(value))
      expect(snakeCase(value)).toBe(snakeCase(value))
      expect(slugify(slugify(value))).toBe(slugify(value))
      expect(camelCase(value)).toBe(camelCase(value))
      expect(capitalize(value)).toBe(capitalize(value))
      expect(uncapitalize(value)).toBe(uncapitalize(value))
    },
  )
})
