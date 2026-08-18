import { normalizeLocales } from "../intl.js"

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

export interface StringCaseOptions {
  readonly locale?: Intl.LocalesArgument
}

const upper = (value: string, locale: Intl.LocalesArgument | undefined): string =>
  locale === undefined ? value.toUpperCase() : value.toLocaleUpperCase(normalizeLocales(locale))

const lower = (value: string, locale: Intl.LocalesArgument | undefined): string =>
  locale === undefined ? value.toLowerCase() : value.toLocaleLowerCase(normalizeLocales(locale))

const printableAscii = /^[\x20-\x7e]*$/

const firstCodePoint = (value: string): string | undefined => {
  const codePoint = value.codePointAt(0)
  return codePoint === undefined ? undefined : String.fromCodePoint(codePoint)
}

/** Uppercases the first Unicode code point deterministically unless a locale is requested. */
export const capitalize = (value: string, options: StringCaseOptions = {}): string => {
  const first = firstCodePoint(value)
  return first === undefined ? "" : upper(first, options.locale) + value.slice(first.length)
}

/** Lowercases the first Unicode code point deterministically unless a locale is requested. */
export const uncapitalize = (value: string, options: StringCaseOptions = {}): string => {
  const first = firstCodePoint(value)
  return first === undefined ? "" : lower(first, options.locale) + value.slice(first.length)
}

const words = (value: string): string[] => {
  if (printableAscii.test(value)) {
    return (
      value
        .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .match(/[A-Za-z0-9]+/g) ?? []
    )
  }
  return (
    value
      .normalize("NFKC")
      .replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, "$1 $2")
      .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  )
}

/** Converts Unicode letter/number words to lower camel case. */
export const camelCase = (value: string, options: StringCaseOptions = {}): string => {
  const parts = words(value)
  if (parts.length === 0) return ""

  let output = lower(parts[0] as string, options.locale)
  for (let index = 1; index < parts.length; index += 1) {
    const part = lower(parts[index] as string, options.locale)
    const first = firstCodePoint(part)
    if (first !== undefined) output += upper(first, options.locale) + part.slice(first.length)
  }
  return output
}

const separatedCase = (value: string, separator: string, options: StringCaseOptions): string => {
  const parts = words(value)
  if (parts.length === 0) return ""
  let output = lower(parts[0] as string, options.locale)
  for (let index = 1; index < parts.length; index += 1) {
    output += separator + lower(parts[index] as string, options.locale)
  }
  return output
}

/** Converts Unicode letter/number words to lower kebab case. */
export const kebabCase = (value: string, options: StringCaseOptions = {}): string =>
  separatedCase(value, "-", options)

/** Converts Unicode letter/number words to lower snake case. */
export const snakeCase = (value: string, options: StringCaseOptions = {}): string =>
  separatedCase(value, "_", options)

const graphemes = (value: string): string[] =>
  Array.from(graphemeSegmenter.segment(value), (part) => part.segment)

/** Truncates by grapheme clusters and includes `omission` within `maximumLength`. */
export const truncate = (value: string, maximumLength: number, omission = "…"): string => {
  if (!Number.isSafeInteger(maximumLength) || maximumLength < 0) {
    throw new RangeError("Maximum length must be a non-negative safe integer")
  }
  if (maximumLength === 0) return ""
  if (value.length <= maximumLength) return value

  if (printableAscii.test(value) && printableAscii.test(omission)) {
    if (omission.length >= maximumLength) return omission.slice(0, maximumLength)
    return value.slice(0, maximumLength - omission.length) + omission
  }

  const omissionCharacters = graphemes(omission)
  if (omissionCharacters.length >= maximumLength) {
    return omissionCharacters.slice(0, maximumLength).join("")
  }

  const prefixLength = maximumLength - omissionCharacters.length
  const prefix: string[] = []
  let length = 0
  for (const part of graphemeSegmenter.segment(value)) {
    if (length < prefixLength) prefix.push(part.segment)
    length += 1
    if (length > maximumLength) return `${prefix.join("")}${omission}`
  }
  return value
}

/** Creates a lowercase, diacritic-stripped kebab-case slug. */
export const slugify = (value: string, options: StringCaseOptions = {}): string =>
  kebabCase(value.normalize("NFKD").replace(/\p{M}+/gu, ""), options)

/** Tests whether a string is empty after native whitespace trimming. */
export const isBlank = (value: string): boolean => value.trim().length === 0
