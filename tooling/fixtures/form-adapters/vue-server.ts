import { useField, useForm } from "@lithekit/form-vue"
import { createSSRApp, defineComponent, h } from "vue"
import { renderToString } from "vue/server-renderer"

const schema = {
  "~standard": {
    version: 1 as const,
    vendor: "adapter-hydration-test",
    types: undefined as unknown as {
      input: { email: string; username?: string }
      output: { email: string; username?: string }
    },
    validate(value: unknown) {
      return { value: value as { email: string; username?: string } }
    },
  },
}

const FieldState = defineComponent({
  setup() {
    // biome-ignore lint/correctness/useHookAtTopLevel: Vue composables belong in setup().
    const field = useField("email")
    return () => h("span", { "data-vue-field-error": "" }, field.error.value ?? "")
  },
})

const ServerApp = defineComponent({
  setup() {
    // biome-ignore lint/correctness/useHookAtTopLevel: Vue composables belong in setup().
    const form = useForm({ initialValues: { email: "Ada@Example.com" }, schema })
    return () =>
      h("form", { novalidate: true, ref: form.formRef }, [
        h("label", ["Email", h("input", { name: "email" })]),
        h(FieldState),
        h("button", { type: "button" }, "Server error"),
        h("button", { type: "button" }, "Clear server error"),
        h("button", { type: "button" }, "Switch field"),
        h("button", { type: "submit" }, "Save"),
        h("output", { "data-vue-saved": "" }),
      ])
  },
})

export const render = (): Promise<string> => renderToString(createSSRApp(ServerApp))
