import { Form, useField, useForm } from "@lithekit/form-react"
import { renderToString } from "react-dom/server"

const schema = {
  "~standard": {
    version: 1 as const,
    vendor: "adapter-hydration-test",
    types: undefined as unknown as {
      input: { email: string }
      output: { email: string }
    },
    validate(value: unknown) {
      return { value: value as { email: string } }
    },
  },
}

const EmailField = () => {
  const field = useField("email")
  return (
    <label>
      Email
      <input name="email" />
      <span data-react-field-error>{field.error ?? ""}</span>
    </label>
  )
}

const ServerApp = () => {
  const form = useForm({ initialValues: { email: "Ada@Example.com" }, schema })
  return (
    <Form form={form}>
      <EmailField />
      <button type="button">Server error</button>
      <button type="button">Clear server error</button>
      <button type="submit">Save</button>
      <output data-react-saved />
    </Form>
  )
}

export const render = (): string => renderToString(<ServerApp />)
