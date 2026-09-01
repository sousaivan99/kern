import { Form, useField, useForm } from "@lithekit/form-react"
import { memo, StrictMode, useEffect, useState } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"

declare global {
  interface Window {
    reactFieldRenders: number
  }
}

const schema = {
  "~standard": {
    version: 1 as const,
    vendor: "adapter-browser-test",
    types: undefined as unknown as {
      input: { email: string }
      output: { email: string }
    },
    validate(value: unknown) {
      const draft = value as { email?: unknown }
      if (typeof draft.email !== "string" || !draft.email.includes("@")) {
        return { issues: [{ message: "Invalid email address", path: ["email"] }] }
      }
      return { value: { email: draft.email.toLowerCase() } }
    },
  },
}

window.reactFieldRenders = 0

const EmailField = memo(() => {
  const field = useField("email")
  window.reactFieldRenders += 1
  return (
    <label>
      Email
      <input name="email" />
      <span data-react-field-error>{field.error ?? ""}</span>
    </label>
  )
})

export const App = () => {
  const form = useForm({ initialValues: { email: "Ada@Example.com" }, schema })
  const [saved, setSaved] = useState("")
  useEffect(() => {
    document.body.dataset.reactMounted = "true"
  }, [])
  return (
    <Form
      form={form}
      onSubmit={form.handleSubmit((output) => {
        setSaved(output.email)
      })}
      ref={(element) => {
        document.body.dataset.reactForwardedRef = String(element !== null)
      }}
    >
      <EmailField />
      <button type="button" onClick={() => form.setFieldError("$form", "Unrelated server error")}>
        Server error
      </button>
      <button type="button" onClick={() => form.setFieldError("$form")}>
        Clear server error
      </button>
      <button type="submit">Save</button>
      <output data-react-saved>{saved}</output>
    </Form>
  )
}

const root = document.querySelector("#root") as HTMLElement
const application = (
  <StrictMode>
    <App />
  </StrictMode>
)
if (root.hasChildNodes()) hydrateRoot(root, application)
else createRoot(root).render(application)
