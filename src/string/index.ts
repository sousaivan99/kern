const codePoints = (value: string): string[] => [...value]

/** Uppercases the first Unicode code point using the host locale. */
export const capitalize = (value: string): string => {
  const [first, ...rest] = codePoints(value)
  return first === undefined ? "" : first.toLocaleUpperCase() + rest.join("")
}

/** Lowercases the first Unicode code point using the host locale. */
export const uncapitalize = (value: string): string => {
  const [first, ...rest] = codePoints(value)
  return first === undefined ? "" : first.toLocaleLowerCase() + rest.join("")
}

const words = (value: string): string[] =>
  value
    .normalize("NFKC")
    .replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, "$1 $2")
    .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2")
    .match(/[\p{L}\p{N}]+/gu) ?? []

/** Converts Unicode letter/number words to lower camel case. */
export const camelCase = (value: string): string => {
  const parts = words(value).map((part) => part.toLocaleLowerCase())
  return parts.map((part, index) => (index === 0 ? part : capitalize(part))).join("")
}

/** Converts Unicode letter/number words to lower kebab case. */
export const kebabCase = (value: string): string =>
  words(value)
    .map((part) => part.toLocaleLowerCase())
    .join("-")

/** Converts Unicode letter/number words to lower snake case. */
export const snakeCase = (value: string): string =>
  words(value)
    .map((part) => part.toLocaleLowerCase())
    .join("_")

/**
 * Truncates by Unicode code points and includes `omission` within `maximumLength`.
 * Grapheme clusters are not segmented.
 */
export const truncate = (value: string, maximumLength: number, omission = "…"): string => {
  if (!Number.isSafeInteger(maximumLength) || maximumLength < 0) {
    throw new RangeError("Maximum length must be a non-negative safe integer")
  }
  const characters = codePoints(value)
  if (characters.length <= maximumLength) return value
  const omissionCharacters = codePoints(omission)
  if (omissionCharacters.length >= maximumLength) {
    return omissionCharacters.slice(0, maximumLength).join("")
  }
  return `${characters.slice(0, maximumLength - omissionCharacters.length).join("")}${omission}`
}

/** Creates a lowercase, diacritic-stripped kebab-case slug. */
export const slugify = (value: string): string =>
  kebabCase(value.normalize("NFKD").replace(/\p{M}+/gu, ""))

/** Tests whether a string is empty after native whitespace trimming. */
export const isBlank = (value: string): boolean => value.trim().length === 0
