import { array, number } from "@sousaivan/kern/validation"

export const Prices = array(number().integer()).min(1).max(100)
