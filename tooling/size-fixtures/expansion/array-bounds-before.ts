import { array, number } from "@lithekit/validation"

export const Prices = array(number().integer()).refine(
  (values) => values.length >= 1 && values.length <= 100,
)
