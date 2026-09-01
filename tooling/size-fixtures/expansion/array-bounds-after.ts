import { array, number } from "@lithekit/validation"

export const Prices = array(number().integer()).min(1).max(100)
