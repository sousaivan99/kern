import { field, model } from "../runtime.js"

const address = field.object({
  street: field.string().trim().min(1),
  city: field.string().trim().min(2),
  countryCode: field.string().trim().length(2),
  postalCode: field.string().trim().min(3).max(12),
})

const profile = field.object({
  displayName: field.string().trim().min(2).max(80),
  biography: field.string().trim().max(500).optional(),
  address,
})

export const AdvancedUser = model("AdvancedUser", {
  id: field.string().uuid().describe({ example: "123e4567-e89b-42d3-a456-426614174000" }),
  profile,
  roles: field.array(field.string().trim().min(1)).min(1).max(10),
  preferences: field.object({
    marketingEmails: field.boolean().default(false),
    locale: field.string().trim().min(2).max(10).default("en"),
  }),
  score: field.number().finite().min(0).max(100),
})
