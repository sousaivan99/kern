import { field, model } from "../runtime.js"

const batchUser = field.object({
  username: field.string().trim().min(3).max(32),
  email: field.string().trim().email(),
  age: field.number().integer().min(18).max(130),
})

export const UserBatch = model("UserBatch", {
  requestId: field.string().uuid(),
  users: field.array(batchUser).min(1).max(10_000),
})
