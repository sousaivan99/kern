/** Normalizes modern locale inputs for the narrower Intl overloads shipped by TypeScript 5.0. */
export const normalizeLocales = (
  locales: Intl.LocalesArgument | undefined,
): string | string[] | undefined => {
  if (locales === undefined) return undefined
  return Array.isArray(locales) ? locales.map(String) : String(locales)
}
