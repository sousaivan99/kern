# Kern model compiler experiment

This branch tests a possible future Kern model compiler. It is deliberately isolated under
`tooling/`; it does not change the released `@sousaivan/kern` API or its bundle budgets.

The experiment asks whether one beginner-friendly model can safely provide:

- a runtime validator;
- a TypeScript type with the same name;
- JSON Schema and OpenAPI components;
- framework-neutral form information;
- deterministic example data;
- an optional generated validation fast path.

It is a proof, not a Kern 2.0 roadmap or production-ready compiler.

## Intended developer experience

A developer writes one model:

```ts
export const User = model("User", {
  username: field.string().trim().min(3).max(32),
  email: field.string().trim().email(),
  age: field.number().integer().min(18).max(130).safeInteger(),
})
```

The generated barrel lets the same import work as a value and a type:

```ts
import { User } from "./generated/models.js"

const user: User = User.parse(requestBody)
```

There is no per-output configuration in the experiment. One generation command emits every
supported view:

```bash
bun run model:generate
```

The generated directory contains a small TypeScript facade and a JavaScript validator per model,
plus combined JSON Schema, OpenAPI, form, example, and explanation artifacts. Per-model emission is
important: importing `User` does not pull the 100- or 1,000-field stress models into its bundle.

## How validation works

For inputs that pass, the generated validator performs direct JavaScript checks specialized for the
model. It avoids walking Kern's general schema graph.

For inputs that fail—or when parse options are supplied—the prototype delegates to the ordinary Kern
schema. This keeps current issue codes, paths, aggregation, exception safety, Standard Schema V1,
`abortEarly`, and `maxIssues` behavior. The tradeoff is that failures do some work twice and the bundle
contains both the generated fast path and the Kern fallback. Accessor properties may also be read
twice on a failing input, so generating the detailed failure path is a correctness requirement before
this design could ship.

Custom application checks are intentionally not serialized. A model using `.check(...)` keeps the
normal Kern runtime validator, and the report explains that JSON Schema and OpenAPI cannot execute
application code. String transformations such as `.trim()` are compiled for runtime use but reported
as transformations that JSON Schema can describe only partially.

## Test coverage

The focused tests cover:

- the same `User` import used as both a runtime value and TypeScript type;
- parse, safeParse, Standard Schema V1, structured issues, deep paths, and thrown getters;
- `abortEarly`, `maxIssues`, stripping unknown keys, immutability, optional fields, and defaults;
- a beginner three-field `User`;
- an advanced nested model with arrays and metadata;
- a runtime-only custom check;
- batches of 1,000 users;
- objects containing 10, 100, and 1,000 validated fields;
- 5,000 deterministic mixed valid/invalid User inputs compared with current Kern;
- deterministic generation and checked-in artifact freshness;
- JSON Schema, OpenAPI, form, example, and explanation output;
- tree-shaking isolation for the generated User bundle;
- benchmark fixture correctness outside the timed path.

Run them with:

```bash
bun test tooling/tests/model-compiler.test.ts tooling/tests/model-compiler-benchmark.test.ts
bun --filter @kern/tooling typecheck
```

## Benchmark method

The validation suite has 22 matched scenarios and 44 cases. Every scenario compares the current
Kern schema with the compiled model using equal inputs and verified observable results. It measures
small valid and invalid users, nested models, arrays from 1 to 1,000 users, wide objects from 10 to
1,000 fields, and a small schema receiving 10,000 unknown input keys.

Full runs use 20 ms warmup, 21 samples, about 20 ms per sample, median and p95 reporting, and fixture
verification before timing. The suite was run twice in opposite implementation orders on both Bun
and Node to check order sensitivity.

```bash
bun run benchmark:compiler
bun run benchmark:compiler:generation
```

Measured on 2026-08-24 with an AMD Ryzen 9 7950X:

| Scenario | Bun 1.3.14 compiled versus runtime | Node 24.16 compiled versus runtime |
| --- | ---: | ---: |
| Beginner User parse success | 2.23x faster | 4.73x faster |
| Beginner User safeParse success | 2.29x faster | 4.64x faster |
| Advanced nested parse success | 3.25x faster | 6.71x faster |
| 1,000-user batch parse success | 1.65x faster | 1.74x faster |
| 100-field parse success | 3.37x faster | 3.61x faster |
| Advanced nested failure | 1.24x slower | 1.20x slower |
| 1,000-user failure at the end | 1.28x slower | 1.22x slower |
| 1,000-field parse success | 1.33x slower | 1.85x slower |
| 1,000-field failure at the end | 2.90x slower | 3.93x slower |

Both orderings produced the same broad result: generated code wins the normal success paths through
100 fields, the current runtime wins failure paths, and a single enormous 1,000-field generated
function is too large for the JavaScript engines to optimize well. The full Bun score was 12 of 22
for compiled versus 10 of 22 for runtime; Node was effectively 11 versus 11, with one reversed-order
run scoring 11.5 versus 10.5 because one case entered the 10% near-tie band.

Compiler generation itself was inexpensive in this prototype:

| Model size | Median generation time on Bun 1.3.14 |
| ---: | ---: |
| 3 fields | 7.8 microseconds |
| 10 fields | 17.7 microseconds |
| 100 fields | 139 microseconds |
| 1,000 fields | 1.50 milliseconds |

These numbers measure descriptor-to-artifact generation, not TypeScript source parsing or a full
application build.

## Bundle measurements

Run:

```bash
bun run model:size
```

Minified browser-target bundles compressed with gzip level 9 measured:

| Fixture | Runtime schema | Compiled model | Difference |
| --- | ---: | ---: | ---: |
| Beginner User | 3,942 B | 5,695 B | +1,753 B (+44%) |
| Advanced User | 5,759 B | 6,361 B | +602 B (+10%) |

The earlier single-file emitter accidentally pulled the stress models into `User` and produced a
35,769 B gzip bundle. Per-model output fixed that, and a regression test now checks that `field999`
cannot appear in the compiled User bundle. The remaining overhead exists because this proof ships
both the generated success path and the full Kern failure fallback.

## What the experiment proves

- The one-name value/type experience is possible with a small generated TypeScript facade.
- A single model can drive validation, types, JSON Schema, OpenAPI components, forms, and examples.
- Specialized JavaScript can materially speed up common valid inputs without using Rust or Wasm.
- Generated code is not automatically faster: very large functions regress, and the fallback makes
  invalid inputs slower.
- Per-model code splitting is required for Kern's bundle-size promise.
- Beginner explanations can be generated without hiding standards limitations.

## What must improve before this could become a product

1. Generate detailed failure code so invalid inputs do not execute both validators and the normal
   schema fallback can be removed from production bundles.
2. Split or loop very wide validators instead of emitting one enormous function.
3. Parse model source without executing arbitrary application modules during generation.
4. Add real endpoint declarations before claiming complete OpenAPI documents; this proof emits only
   reusable schema components.
5. Define how form metadata is consumed by optional React, Vue, Svelte, and plain-web adapters.
6. Test full, unbundled integrations on Node 22/24/26, Bun, Deno, and evergreen browsers.
7. Benchmark cold start, memory, build time, and bundle size across realistic applications—not only
   hot validation loops.

The current conclusion is promising but intentionally mixed: the model ecosystem idea is valuable,
and specialization clearly helps normal payloads, but this fast-path-plus-fallback compiler is not
yet a suitable replacement for Kern validation.
