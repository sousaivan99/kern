import type { StandardSchemaV1 as OfficialStandardSchemaV1 } from "@standard-schema/spec"
import {
  type Infer,
  type InferInput,
  type InferOutput,
  literal,
  number,
  object,
  type Schema,
  type StandardSchemaV1,
  string,
} from "../../src/validation/index.js"

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false
type Assert<T extends true> = T

const User = object({
  name: string(),
  age: number().optional(),
  role: string().default("member"),
})

type UserOutput = InferOutput<typeof User>
type UserInput = InferInput<typeof User>
type _InferAliasesOutput = Assert<Equal<Infer<typeof User>, UserOutput>>
type _NameIsString = Assert<Equal<UserOutput["name"], string>>
type _AgeIsOptionalNumber = Assert<Equal<UserOutput["age"], number | undefined>>
type _RoleOutputIsRequired = Assert<Equal<UserOutput["role"], string>>

const validOutput: UserOutput = { name: "Ada", role: "member" }
const validInput: UserInput = { name: "Ada" }
void validOutput
void validInput

// @ts-expect-error name remains required in input
const missingInputName: UserInput = {}
void missingInputName

const transformed = string().transform((value) => value.length)
type _TransformOutput = Assert<Equal<InferOutput<typeof transformed>, number>>
type _TransformInput = Assert<Equal<InferInput<typeof transformed>, string>>

const narrowed = string().refine((value): value is "yes" => value === "yes")
const narrowSchema: Schema<"yes", string> = narrowed
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
type _DefaultAllowsMissingInput = Assert<
  Equal<InferInput<typeof defaultAfterUndefinedTransform>, string | undefined>
>

const nullableOptional = string().optional().nullable()
type _NullableOptionalOutput = Assert<
  Equal<InferOutput<typeof nullableOptional>, string | null | undefined>
>
type _NullableOptionalInput = Assert<
  Equal<InferInput<typeof nullableOptional>, string | null | undefined>
>

const PublicUser = User.pick(["name"]).extend({ id: number(), name: string().min(2) })
type PublicUserOutput = Infer<typeof PublicUser>
const publicUser: PublicUserOutput = { id: 1, name: "Ada" }
void publicUser

// @ts-expect-error pick only accepts known keys
User.pick(["missing"])
// @ts-expect-error omit only accepts known keys
User.omit(["missing"])

const PatchUser = User.partial()
const emptyPatch: Infer<typeof PatchUser> = {}
const emptyPatchInput: InferInput<typeof PatchUser> = {}
void emptyPatch
void emptyPatchInput

const OpenUser = User.passthrough()
const openUser: Infer<typeof OpenUser> = { name: "Ada", role: "member", custom: true }
const customValue: unknown = openUser.custom
void customValue

const transformedObject = User.transform((value) => value.name)
// @ts-expect-error general transforms intentionally do not retain object composition methods
transformedObject.pick(["name"])

const standardInput: InferInput<typeof User> | undefined = User["~standard"].types?.input
const standardOutput: InferOutput<typeof User> | undefined = User["~standard"].types?.output
void standardInput
void standardOutput

const kernStandard: StandardSchemaV1<UserInput, UserOutput> = User
const officialPrimitive: OfficialStandardSchemaV1<string, string> = string()
const officialObject: OfficialStandardSchemaV1<UserInput, UserOutput> = User
const officialOptional: OfficialStandardSchemaV1<string | undefined, string | undefined> =
  string().optional()
const officialDefault: OfficialStandardSchemaV1<string | undefined, string> =
  string().default("fallback")
const officialTransform: OfficialStandardSchemaV1<string, number> = transformed
void kernStandard
void officialPrimitive
void officialObject
void officialOptional
void officialDefault
void officialTransform

type _OfficialTransformInput = Assert<
  Equal<OfficialStandardSchemaV1.InferInput<typeof transformed>, string>
>
type _OfficialTransformOutput = Assert<
  Equal<OfficialStandardSchemaV1.InferOutput<typeof transformed>, number>
>
type _KernTransformInput = Assert<Equal<StandardSchemaV1.InferInput<typeof transformed>, string>>
type _KernTransformOutput = Assert<Equal<StandardSchemaV1.InferOutput<typeof transformed>, number>>

User["~standard"].validate({ name: "Ada" }, { libraryOptions: { consumer: "type-contract" } })

// @ts-expect-error validation execution is package-private
User._run
// @ts-expect-error schema presence is package-private
User._presence

interface StandardConsumer {
  readonly "~standard": {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) =>
      | { readonly value: unknown; readonly issues?: undefined }
      | {
          readonly issues: readonly {
            readonly message: string
            readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined
          }[]
        }
      | Promise<unknown>
  }
}
const standardCompatible: StandardConsumer = User
void standardCompatible
