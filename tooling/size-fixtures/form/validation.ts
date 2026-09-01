import { createForm } from "@lithekit/form"
import { number, object, string } from "@lithekit/validation"

const Account = object({
  profile: object({ email: string().trim().email() }),
  age: number().integer().min(18),
})

export const accountForm = createForm({ schema: Account })
