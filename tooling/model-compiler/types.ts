import { AdvancedUser, type RuntimeOnlyUser, User, type UserBatch } from "./generated/models.js"

type Assert<T extends true> = T
type Extends<From, To> = From extends To ? true : false

type ExpectedUser = {
  readonly age: number
  readonly email: string
  readonly username: string
}

type _UserMatchesExpectedShape = Assert<Extends<User, ExpectedUser>>
type _ExpectedShapeMatchesUser = Assert<Extends<ExpectedUser, User>>

const parsed = User.parse({ age: 36, email: "ada@example.com", username: "ada" })
const assignable: User = parsed
void assignable

const acceptsUser = (user: User): string => user.email
acceptsUser(User.parse({ age: 36, email: "ada@example.com", username: "ada" }))

type ExpectedAdvancedUser = {
  readonly id: string
  readonly preferences: {
    readonly locale: string
    readonly marketingEmails: boolean
  }
  readonly profile: {
    readonly address: {
      readonly city: string
      readonly countryCode: string
      readonly postalCode: string
      readonly street: string
    }
    readonly biography?: string
    readonly displayName: string
  }
  readonly roles: string[]
  readonly score: number
}

type _AdvancedOutputIsInferred = Assert<Extends<AdvancedUser, ExpectedAdvancedUser>>
type _AdvancedExpectedShapeIsAccepted = Assert<Extends<ExpectedAdvancedUser, AdvancedUser>>
type ExpectedRuntimeOnlyUser = { readonly email: string; readonly username: string }
type _RuntimeOnlyOutputIsInferred = Assert<Extends<RuntimeOnlyUser, ExpectedRuntimeOnlyUser>>
type _RuntimeOnlyExpectedShapeIsAccepted = Assert<Extends<ExpectedRuntimeOnlyUser, RuntimeOnlyUser>>
type ExpectedUserBatch = {
  readonly requestId: string
  readonly users: {
    readonly age: number
    readonly email: string
    readonly username: string
  }[]
}
type _BatchOutputIsInferred = Assert<Extends<UserBatch, ExpectedUserBatch>>
type _BatchExpectedShapeIsAccepted = Assert<Extends<ExpectedUserBatch, UserBatch>>

// @ts-expect-error parsed users require an email
const missingEmail: User = { age: 36, username: "ada" }
void missingEmail

// @ts-expect-error parsed users keep age numeric
const stringAge: User = { age: "36", email: "ada@example.com", username: "ada" }
void stringAge

AdvancedUser.parse({
  id: "123e4567-e89b-42d3-a456-426614174000",
  preferences: {},
  profile: {
    address: { city: "London", countryCode: "GB", postalCode: "NW1", street: "One Way" },
    displayName: "Ada",
  },
  roles: ["admin"],
  score: 99,
})
