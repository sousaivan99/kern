import { number, object, string } from "../../../packages/kern/src/validation/index.js"

const User = object({
  username: string().trim().min(3).max(32),
  email: string().trim().email(),
  age: number().integer().min(18).max(130).refine(Number.isSafeInteger, {
    code: "not_safe_integer",
    message: "Expected a safe integer",
  }),
})

export const validateUser = (input: unknown) => User.safeParse(input)
