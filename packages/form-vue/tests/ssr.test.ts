import { expect, test } from "bun:test"
import { renderToString } from "@vue/server-renderer"
import { createSSRApp, h } from "vue"
import { useForm } from "../src/index.js"

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

test("imports and renders without DOM access during Vue SSR", async () => {
  const app = createSSRApp({
    setup() {
      const form = useForm({ schema })
      return () => h("form", { ref: form.formRef }, [h("input", { name: "email" })])
    },
  })
  expect(await renderToString(app)).toContain('name="email"')
})
