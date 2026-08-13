import {
  array,
  enumeration,
  type Infer,
  literal,
  number,
  object,
  string,
  union,
} from "@kern/core/validation"

export const runValidationExamples = (): void => {
  console.log("\nValidation")

  const UserSchema = object({
    name: string().trim().min(2),
    email: string().trim().email(),
    age: number().integer().min(18).optional(),
    role: enumeration(["member", "admin"] as const).default("member"),
    notifications: array(union([literal("email"), literal("push")] as const)),
  })

  type User = Infer<typeof UserSchema>
  const user: User = UserSchema.parse({
    name: " Grace Hopper ",
    email: "grace@example.com",
    notifications: ["email"],
  })
  console.log("parsed user", user)

  const invalid = UserSchema.safeParse({
    name: "G",
    email: "not-an-email",
    age: 12,
    notifications: ["sms"],
  })
  if (!invalid.success) console.log("structured issues", invalid.errors)

  const PortSchema = string()
    .trim()
    .transform(Number)
    .refine((port) => Number.isInteger(port) && port >= 1 && port <= 65_535, {
      code: "invalid_port",
      message: "Expected a TCP port from 1 to 65535",
    })
  console.log("transformed port", PortSchema.parse(" 3000 "))
}

if (import.meta.main) runValidationExamples()
