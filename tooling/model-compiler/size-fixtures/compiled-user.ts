import { User } from "../generated/user.js"

export const validateUser = (input: unknown) => User.safeParse(input)
