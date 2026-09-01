import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { Form, useForm } from "../src/index.js"

const schema = {
  "~standard": {
    version: 1 as const,
    vendor: "test",
    types: undefined as unknown as { input: { email: string }; output: { email: string } },
    validate(value: unknown) {
      return { value: value as { email: string } }
    },
  },
}

const AccountForm = () => {
  const form = useForm({ schema })
  return createElement(Form, { form }, createElement("input", { name: "email" }))
}

test("imports and renders without DOM access during React SSR", () => {
  const html = renderToString(createElement(AccountForm))
  expect(html).toContain('name="email"')
  expect(html).toContain("noValidate")
})
