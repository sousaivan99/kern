import {
  type Infer,
  literal,
  number,
  object,
  type Schema,
  string,
} from "../../src/validation/index.js"

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false
type Assert<T extends true> = T

const schema = object({
  name: string(),
  age: number().optional(),
})

type User = Infer<typeof schema>
type _NameIsString = Assert<Equal<User["name"], string>>
type _AgeIsOptionalNumber = Assert<Equal<User["age"], number | undefined>>

const validUser: User = { name: "Ada" }
void validUser

// @ts-expect-error name remains required
const missingName: User = {}
void missingName

const transformed = string().transform((value) => value.length)
type _TransformOutput = Assert<Equal<Infer<typeof transformed>, number>>

const narrowed = string().refine((value): value is "yes" => value === "yes")
const narrowSchema: Schema<"yes"> = narrowed
void narrowSchema

const booleanRefinement = string().refine((value) => value.length > 0)
type _BooleanRefinementPreservesString = Assert<Equal<Infer<typeof booleanRefinement>, string>>

// @ts-expect-error boolean refinements cannot claim an arbitrary subtype
string().refine<"yes">(() => true)

const presenceSchema = object({
  defaulted: string().optional().default("fallback"),
  optional: string().optional(),
  requiredUndefined: literal(undefined),
  transformedUndefined: string().transform(() => undefined),
})
type PresenceOutput = Infer<typeof presenceSchema>
const presenceValue: PresenceOutput = {
  defaulted: "fallback",
  requiredUndefined: undefined,
  transformedUndefined: undefined,
}
void presenceValue

// @ts-expect-error a literal(undefined) field is still required
const missingRequiredUndefined: PresenceOutput = {
  defaulted: "fallback",
  transformedUndefined: undefined,
}
void missingRequiredUndefined

const defaultAfterUndefinedTransform = string()
  .transform(() => undefined as string | undefined)
  .default("fallback")
type _DefaultExcludesUndefined = Assert<Equal<Infer<typeof defaultAfterUndefinedTransform>, string>>
