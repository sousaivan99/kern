import { useField, useForm } from "@lithekit/form-vue"
import { createApp, createSSRApp, defineComponent, h, onMounted, ref } from "vue"

declare global {
  interface Window {
    vueFieldRenders: number
  }
}

const schema = {
  "~standard": {
    version: 1 as const,
    vendor: "adapter-browser-test",
    types: undefined as unknown as {
      input: { email: string; username?: string }
      output: { email: string; username?: string }
    },
    validate(value: unknown) {
      const draft = value as { email?: unknown; username?: unknown }
      if (typeof draft.email !== "string" || !draft.email.includes("@")) {
        return { issues: [{ message: "Invalid email address", path: ["email"] }] }
      }
      return { value: { email: draft.email.toLowerCase(), username: draft.username } }
    },
  },
}

window.vueFieldRenders = 0

const FieldState = defineComponent({
  props: { name: { required: true, type: String } },
  setup(props) {
    // biome-ignore lint/correctness/useHookAtTopLevel: Vue composables belong in setup().
    const field = useField(() => props.name)
    return () => {
      window.vueFieldRenders += 1
      return h("span", { "data-vue-field-error": "" }, field.error.value ?? "")
    }
  },
})

export const App = defineComponent({
  setup() {
    // biome-ignore lint/correctness/useHookAtTopLevel: Vue composables belong in setup().
    const form = useForm({ initialValues: { email: "Ada@Example.com" }, schema })
    const fieldName = ref("email")
    const saved = ref("")
    onMounted(() => {
      document.body.dataset.vueMounted = "true"
    })
    return () =>
      h(
        "form",
        {
          novalidate: true,
          onSubmit: form.handleSubmit((output) => {
            saved.value = output.email
          }),
          ref: form.formRef,
        },
        [
          h("label", ["Email", h("input", { name: "email" })]),
          h(FieldState, { name: fieldName.value }),
          h(
            "button",
            {
              onClick: () => form.setFieldError("$form", "Unrelated server error"),
              type: "button",
            },
            "Server error",
          ),
          h(
            "button",
            { onClick: () => form.setFieldError("$form"), type: "button" },
            "Clear server error",
          ),
          h(
            "button",
            {
              onClick: () => {
                fieldName.value = fieldName.value === "email" ? "username" : "email"
              },
              type: "button",
            },
            "Switch field",
          ),
          h("button", { type: "submit" }, "Save"),
          h("output", { "data-vue-saved": "" }, saved.value),
        ],
      )
  },
})

const root = document.querySelector("#root") as HTMLElement
if (root.hasChildNodes()) createSSRApp(App).mount(root)
else createApp(App).mount(root)
