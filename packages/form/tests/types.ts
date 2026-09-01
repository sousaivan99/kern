import { createForm, type FormDraft, type StandardSchemaV1 } from "../src/index.js"

interface AccountInput {
  readonly age?: number | undefined
  readonly email: string
}

interface AccountOutput {
  readonly age: number
  readonly email: string
}

declare const schema: StandardSchemaV1<AccountInput, AccountOutput>
const form = createForm({ schema, initialValues: { email: "" } })
const draft: FormDraft<AccountInput> = form.values.value
form.handleSubmit((output) => {
  const age: number = output.age
  void age
})
void draft
