import { deepFreeze, hasOwnPath, omit, pick } from "@kern/core/object"

export const runObjectExamples = (): void => {
  console.log("\nObject")

  const account = {
    id: "acct-42",
    email: "ada@example.com",
    passwordHash: "never-return-this",
    profile: { displayName: "Ada", preferences: { theme: "dark" } },
  }

  console.log("public fields", pick(account, ["id", "email"]))
  console.log("without secret", omit(account, ["passwordHash"]))
  console.log("safe nested lookup", hasOwnPath(account, "profile.preferences.theme"))
  console.log("blocked prototype path", hasOwnPath(account, "constructor.prototype"))

  const configuration = deepFreeze({ api: { timeout: 5_000 }, features: ["search"] })
  console.log("deeply frozen", Object.isFrozen(configuration), Object.isFrozen(configuration.api))
}

if (import.meta.main) runObjectExamples()
