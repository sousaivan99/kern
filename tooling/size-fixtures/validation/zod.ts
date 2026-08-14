import * as z from "zod"

export const User = z.object({
  name: z.string().min(2),
  email: z.email(),
})
