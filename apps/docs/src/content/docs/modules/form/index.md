---
title: Form
description: Build native, schema-validated forms with the framework-agnostic Lithekit controller.
---

Install the native controller by itself:

```bash
npm install @lithekit/form
```

`@lithekit/form` has no runtime dependencies. It accepts any synchronous or asynchronous Standard
Schema V1 implementation structurally, so Lithekit Validation is optional.

```ts
import { createForm } from "@lithekit/form"
import { number, object, string } from "@lithekit/validation"

const AccountSchema = object({ email: string().email(), age: number().optional() })
const saveAccount = async (account: { email: string; age?: number }) => {
  console.log(account.email)
}

const form = createForm({
  schema: AccountSchema,
  initialValues: { email: "", age: undefined },
  validateOn: "progressive",
  focusInvalid: true,
})

const element = document.querySelector<HTMLFormElement>("#account-form")
form.attach(element)
element?.addEventListener("submit", form.handleSubmit(saveAccount))
```

## State and validation timing

Controller state is exposed through readonly signals. Read the current snapshot from `.value` and
subscribe with a function that returns an unsubscribe callback. `valid` starts as `true`, meaning
there are no known issues; use `validated` to distinguish that from schema-confirmed validity.

The default `progressive` mode validates the complete schema on blur, change, and submit. After a
field is invalid or submission has been attempted, input events revalidate it. `input` validates on
every input or change, while `submit` validates only on submission or an explicit `validate()`.
Standard Schema has no field-validator contract, so every trigger validates the whole form.

Only one async validation runs at a time, with at most one queued validation for the newest draft.
Changing a draft while validation is pending makes that result `stale`; stale work never replaces
issues, output, or validity. Concurrent submissions are ignored. `submitting` remains true through
the valid or invalid callback, and unexpected schema or callback exceptions reject the handler.

## Performance model

Normal input and change events decode only the affected control group. Lithekit path-copies the
changed branch of the immutable draft, updates dirty state incrementally, and publishes only that
field's signals when form-wide errors did not change. Issues are indexed once by canonical field
name instead of being searched again for every field.

Full DOM discovery is reserved for attachment, relevant DOM mutations, reset, submit, and explicit
`validate()` calls, where reading the complete live form is required for correctness. The repository
browser benchmark covers these paths at 10, 100, and 1,000 controls with
`bun run benchmark:form:browser`; its timings are observational rather than universal gates.

## Controls and decoded values

Lithekit reads `form.elements`, including controls outside the form associated through `form="…"`.
It decodes text, date/time, color, hidden, and single-select controls as strings; number and range
controls as numbers; a unique checkbox as boolean; checkbox groups and multiple selects as string
arrays; radios as one string or `undefined`; and file controls as `File` values. Repeated ordinary
names become ordered arrays. Unnamed, disabled, button, reset, submit, and output controls are
ignored.

Dynamic controls are reconciled through captured document events and mutation observation. Removed
controls leave the current draft but retain field state, so a later matching control recovers its
latest committed value. Mixed incompatible control families with one name produce a deterministic
form-level configuration issue.

## Paths and drafts

Names can describe nested values:

```text
user.email
users[0].email
settings.domains[2]
[literal.dotted.name]
user["literal.dotted.name"]
```

Dot segments create records, numeric brackets create arrays, and JSON-quoted brackets create
literal keys. Limits on length, depth, and array indexes prevent abusive structures. Construction
uses null-prototype records and own-property definitions, so names never perform prototype-chain
writes. Malformed or conflicting shapes appear as configuration issues.

The inferred live draft is a deeply partial version of the schema input. This assumes DOM names and
control types match the schema input; schema validation remains the runtime trust boundary. A
successful callback receives schema output, including transformations and defaults.

## Reset, external errors, and files

Without `initialValues`, the first decoded DOM is the reset baseline. Supplied initial values seed
present controls and remain available to controls added later. Dirty comparison is structural for
records and arrays and identity-based for files. Browsers prohibit assigning file selections, so a
nonempty programmatic file value throws a descriptive error.

Use `setErrors()` or `setFieldError()` for server errors. Schema validation replaces schema issues
only. External field errors remain until cleared, reset, or that field is edited; `$form` errors
remain until explicitly cleared or reset.

## Accessibility and ownership

```html
<span data-error-for="email"></span>
<div data-form-error></div>
```

Lithekit updates every matching target, adds `aria-invalid`, and appends generated error-target IDs
to `aria-describedby`. It adds `aria-live="polite"` only when no policy exists. Author attributes
and tokens are preserved and restored during detach. Failed submissions focus the first enabled
invalid control unless `focusInvalid` is false.

Attachment disables native constraint-validation UI with `noValidate` and restores the old value
on detach. Lithekit does not use `setCustomValidity()` or combine browser messages with schema
messages. `attach(null)` is a reusable detach; `dispose()` is final and idempotent.

Form-associated custom elements, widget/decoder registries, controlled-input abstractions, and
field-array APIs are intentionally outside Form 1.0.
