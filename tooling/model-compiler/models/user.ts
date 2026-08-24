import { field, model } from "../runtime.js"

export const User = model("User", {
  username: field.string().trim().min(3).max(32).describe({ label: "Username", example: "ada" }),
  email: field
    .string()
    .trim()
    .email()
    .describe({ label: "Email address", example: "ada@example.com" }),
  age: field.number().integer().min(18).max(130).safeInteger(),
})
