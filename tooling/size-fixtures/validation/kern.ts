import { object, string } from "@sousaivan/kern/validation"

export const User = object({
  name: string().min(2),
  email: string().email(),
})
