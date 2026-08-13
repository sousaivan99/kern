import { normalizeLocales } from "../intl.js"

const codePoints = (value: string): string[] => [...value]
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

export interface StringCaseOptions {
  readonly locale?: Intl.LocalesArgument
}

const upper = (value: string, locale: Intl.LocalesArgument | undefined): string =>
  locale === undefined ? value.toUpperCase() : value.toLocaleUpperCase(normalizeLocales(locale))

const lower = (value: string, locale: Intl.LocalesArgument | undefined): string =>
  locale === undefined ? value.toLowerCase() : value.toLocaleLowerCase(normalizeLocales(locale))

/** Uppercases the first Unicode code point deterministically unless a locale is requested. */
export const capitalize = (value: string, options: StringCaseOptions = {}): string => {
  const [first, ...rest] = codePoints(value)
  return first === undefined ? "" : upper(first, options.locale) + rest.join("")
}

/** Lowercases the first Unicode code point deterministically unless a locale is requested. */
export const uncapitalize = (value: string, options: StringCaseOptions = {}): string => {
  const [first, ...rest] = codePoints(value)
  return first === undefined ? "" : lower(first, options.locale) + rest.join("")
}

const words = (value: string): string[] =>
  value
    .normalize("NFKC")
    .replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, "$1 $2")
    .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2")
    .match(/[\p{L}\p{N}]+/gu) ?? []

/** Converts Unicode letter/number words to lower camel case. */
export const camelCase = (value: string, options: StringCaseOptions = {}): string => {
  const parts = words(value).map((part) => lower(part, options.locale))
  return parts.map((part, index) => (index === 0 ? part : capitalize(part, options))).join("")
}

/** Converts Unicode letter/number words to lower kebab case. */
export const kebabCase = (value: string, options: StringCaseOptions = {}): string =>
  words(value)
    .map((part) => lower(part, options.locale))
    .join("-")

/** Converts Unicode letter/number words to lower snake case. */
export const snakeCase = (value: string, options: StringCaseOptions = {}): string =>
  words(value)
    .map((part) => lower(part, options.locale))
    .join("_")

const graphemes = (value: string): string[] =>
  Array.from(graphemeSegmenter.segment(value), (part) => part.segment)

/** Truncates by grapheme clusters and includes `omission` within `maximumLength`. */
export const truncate = (value: string, maximumLength: number, omission = "…"): string => {
  if (!Number.isSafeInteger(maximumLength) || maximumLength < 0) {
    throw new RangeError("Maximum length must be a non-negative safe integer")
  }
  if (maximumLength === 0) return ""

  const characters = graphemes(value)
  if (characters.length <= maximumLength) return value
  const omissionCharacters = graphemes(omission)
  if (omissionCharacters.length >= maximumLength) {
    return omissionCharacters.slice(0, maximumLength).join("")
  }
  return `${characters.slice(0, maximumLength - omissionCharacters.length).join("")}${omission}`
}

/** Creates a lowercase, diacritic-stripped kebab-case slug. */
export const slugify = (value: string, options: StringCaseOptions = {}): string =>
  kebabCase(value.normalize("NFKD").replace(/\p{M}+/gu, ""), options)

/** Tests whether a string is empty after native whitespace trimming. */
export const isBlank = (value: string): boolean => value.trim().length === 0
