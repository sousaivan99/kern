import {
  camelCase,
  capitalize,
  isBlank,
  kebabCase,
  slugify,
  snakeCase,
  truncate,
  uncapitalize,
} from "@kern/core/string"

export const runStringExamples = (): void => {
  console.log("\nString")
  console.log("capitalized", capitalize("hello, world"))
  console.log("uncapitalized", uncapitalize("Hello, world"))
  console.log("camel", camelCase("customer account-ID"))
  console.log("kebab", kebabCase("customerAccount ID"))
  console.log("snake", snakeCase("customerAccount ID"))
  console.log("slug", slugify("Crème brûlée & Café!"))
  console.log("truncated Unicode", truncate("A useful message 😀", 12))
  console.log("blank checks", isBlank("  \n"), isBlank("value"))
}

if (import.meta.main) runStringExamples()
