import { object, string } from "@lithekit/validation"

export const User = object({
  name: string().min(2),
  email: string().email(),
})
