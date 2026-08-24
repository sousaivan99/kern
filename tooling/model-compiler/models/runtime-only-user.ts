import { field, model } from "../runtime.js"

export const RuntimeOnlyUser = model("RuntimeOnlyUser", {
  username: field
    .string()
    .trim()
    .min(3)
    .check((value) => value !== "admin", "The reserved username is checked by application code"),
  email: field.string().trim().email(),
})
