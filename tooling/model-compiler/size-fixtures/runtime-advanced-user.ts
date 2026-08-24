import { AdvancedUser as AdvancedUserRuntime } from "../models.js"

export const validateAdvancedUser = (input: unknown) => AdvancedUserRuntime.safeParse(input)
