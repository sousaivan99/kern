import { AdvancedUser } from "../generated/advanced-user.js"

export const validateAdvancedUser = (input: unknown) => AdvancedUser.safeParse(input)
