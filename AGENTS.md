# AGENTS.md

## Project overview

Kern is a zero-runtime-dependency, TypeScript-first, framework-agnostic, ESM-first, tree-shakeable, Bun-based utility toolkit. It provides small primitives commonly replaced by dependencies such as Zod, Lodash, date-fns, and money utility libraries.

> Bundle size is a feature of this project, not an afterthought.

The permanent npm package name is `@kern/core`; the repository name is `kern`.
Kern 1.x is the stable public API line and follows `packages/kern/SEMVER.md`.

## Core principles

1. Do not add runtime dependencies.
2. Prefer native JavaScript and Web APIs; wrap them only when a tiny semantic helper materially improves clarity.
3. Keep public APIs small.
4. Do not recreate Lodash, Zod, or date-fns feature-for-feature.
5. Every exported helper must justify its existence.
6. Preserve tree-shaking.
7. Avoid import-time side effects.
8. Prefer functions over unnecessary classes.
9. Use `unknown` for untrusted data.
10. Avoid `any` unless there is a documented implementation reason.
11. Do not sacrifice correctness merely for benchmark results.
12. Do not mutate caller-owned data unless the API explicitly communicates mutation.

## Runtime and tooling

The repository uses Bun, TypeScript, ESM, `bun:test`, and Biome.

```bash
bun install

bun run build
bun run test
bun run test:watch
bun run test:coverage
bun run test:timezones
bun run test:compat
bun run test:browser
bun run typecheck
bun run typecheck:minimum
bun run lint
bun run format
bun run check
bun run size
bun run benchmark
bun run docs:a11y
bun run docs:check
bun run package:check
bun run audit
```

Run relevant checks after modifying code. For substantial changes, prefer `bun run check` before considering the task complete.

Long-running development commands must remain visibly active without flooding the console. Reuse
`tooling/scripts/shared/workflow.ts` for multi-step checks and
`tooling/scripts/shared/process.ts` when subprocess output should be
collapsed on success and expanded on failure. Test and build commands should report their current
work and real progress. `@clack/prompts` is a development-only console dependency and must never be
imported by `packages/kern/src/` or included in published runtime entrypoints.

## Repository structure

```text
apps/docs/       Astro/Starlight/Tailwind documentation application
packages/kern/   Publishable @kern/core source, tests, and package metadata
tooling/         Repository scripts, benchmarks, and tooling tests
```

Runtime source is under `packages/kern/src/`, with one directory per public module. Documentation
source lives in `apps/docs/src/content/docs/` and follows the same module boundaries.

### validation

Owns runtime schemas, parsing, safe parsing, structured validation errors, refinements, transformations, optional/default/nullability behavior, and TypeScript inference. Do not introduce application-specific validation concepts.

### money

Owns minor-unit-first monetary helpers. Use exact integer/`bigint` arithmetic for finance rounding
and allocation, rely on `Intl.NumberFormat` for formatting, and keep currency units unambiguous.
Kern is not an FX engine, provider currency table, ledger, or compliance system.

### date

Owns small native `Date`/`Intl` utilities. Do not mutate supplied dates or pretend timezone arithmetic is trivial. Keep formatting and calendar arithmetic clearly separated.

### number

Owns small numeric calculations and native number formatting helpers.

### string

Owns only high-value string operations. Do not grow it into a general-purpose Lodash replacement.

### array

Owns small collection operations where the native alternative is meaningfully more cumbersome or
less expressive to read. Readability wrappers must document their native equivalent.

### object

Owns safe object operations. Never add arbitrary object-path writes that are prone to prototype pollution.

### async

Owns small Promise, timing, and control-flow helpers. Support `AbortSignal` where it materially improves an API.

## Imports and exports

Prefer consumer subpath imports:

```ts
import { object, string } from "@kern/core/validation"
import { formatMoney } from "@kern/core/money"
import { addDays } from "@kern/core/date"
```

Do not encourage `import * as Kern from "@kern/core"` without a specific reason. Consider how every export affects tree-shaking.

When adding a public helper:

1. Export it from its module.
2. Update package exports if required.
3. Add runtime tests.
4. Add relevant type tests.
5. Add documentation.
6. Check bundle-size impact.
7. Add or update benchmarks when the helper is performance-sensitive or scales with input size.

## Validation architecture

The intended API is fluent and inferred:

```ts
const UserSchema = object({
  name: string().trim().min(2),
  email: string().email(),
  age: number().integer().min(18),
})

const result = UserSchema.safeParse(value)
const user = UserSchema.parse(value)
type User = Infer<typeof UserSchema>
```

Failures contain structured issues:

```ts
{
  path: ["users", 0, "email"],
  code: "invalid_email",
  message: "Invalid email address",
}
```

Important rules:

- `safeParse()` must not throw because ordinary validation failed.
- `parse()` may throw the documented `ValidationError`.
- Nested paths must stay accurate.
- Transforms must preserve inferred input while changing output.
- Optional, default, and nullability semantics must be predictable.
- Validation aggregates by default; nested schemas share issue limits.
- Object schemas compose immutably and strip unknown keys by default.
- Issues must not retain rejected values or callback exceptions.
- Every schema implements synchronous Standard Schema V1 through `~standard`.
- Avoid needless allocations in hot paths.
- Avoid deep inheritance trees unless clearly justified.

## Native-first policy

Before implementing a helper, check whether modern runtimes already provide it. Prefer `Intl`, `URL`, `URLSearchParams`, `crypto`, `structuredClone`, `AbortController`, `AbortSignal`, `Promise`, `Map`, `Set`, `Object`, and `Array`.

Small semantic wrappers are acceptable when their name materially clarifies intent, their contract
stays predictable, and their documentation teaches the equivalent native expression. Do not wrap
native APIs merely to grow the API. For example, do not add:

```ts
export const map = <T, R>(array: T[], fn: (value: T) => R) => array.map(fn)
```

## Bundle-size policy

Approximate targets:

```text
validation     < 5 KB gzip
money          < 2.5 KB gzip
date           < 2 KB gzip
string         < 2 KB gzip
simple helper  ideally hundreds of bytes
runtime dependencies: 0
```

Targets do not override correctness. Investigate significant increases rather than silently accepting them. Run `bun run size` for changes to runtime code.

## Testing requirements

Use:

```ts
import { describe, expect, test } from "bun:test"
```

Test public observable behavior, not implementation details. For bugs: reproduce the bug in a failing test, implement the fix, and verify the regression test passes.

Validation changes should normally test success, failure, issue codes, issue paths, and inferred types where applicable.

Benchmarks contain lightweight result verification to reject stale fixtures, but they never replace
runtime or type tests. Every behavior change still requires focused correctness coverage.

## Type safety

Do not weaken public types to solve local implementation problems. Avoid casually introducing `any`, `as any`, `// @ts-ignore`, or `// @ts-nocheck`. Keep necessary casts narrow and local. Public APIs should infer without manual generic arguments.

When changing schema types, verify both runtime behavior and compile-time inference.

## Performance

Do not prematurely optimize small helpers. Validation and collection operations over large inputs
are the primary performance-sensitive paths. The dependency-free suite under `tooling/benchmarks/` covers
small and large inputs, emits robust summary statistics, and supports JSON output for before/after
comparison. When changing performance-sensitive internals:

- avoid repeated object creation where practical;
- avoid unnecessary exception handling on successful paths;
- avoid repeatedly rebuilding static metadata;
- measure rather than speculate.

Run `bun run benchmark:quick` after changing benchmark definitions. Run the relevant full suite
before and after material changes to any performance-sensitive or input-scaling path, preserving
JSON results when a pull request makes a performance claim. Update existing cases when behavior or
workload shape changes, and add cases for new helpers that are performance-sensitive or scale with
input size. Comparisons must use equivalent semantics and comparable environments; never remove
validation, safety, descriptor preservation, output construction, or useful error information
merely to improve a number. Do not add universal timing thresholds to `bun run check`, because
shared hardware varies.

## Coding style

Prefer small focused functions, explicit names, early returns, immutable behavior, straightforward control flow, useful `readonly`, discriminated unions, and simple data structures.

Avoid unnecessary classes, factories wrapping factories, excessive generics, clever type-level programming without substantial API benefit, giant files, speculative abstractions, and generic dumping grounds. Do not create `helpers.ts`, `common.ts`, `misc.ts`, or `utils.ts` without a clear narrow ownership boundary.

## Adding features

A public helper is admitted only when it removes meaningful boilerplate, improves TypeScript
narrowing, or prevents a common correctness error. It must also pass the questions below.

Before adding a helper or module, answer internally:

1. Is this commonly reimplemented?
2. Is the native API insufficient, unnecessarily cumbersome, or materially less clear at the call site?
3. Can this remain very small?
4. Does it belong in an existing module?
5. Will users understand the behavior from its name?
6. Is it worth maintaining permanently?

If not, do not add it.

## Backward compatibility

Once released, do not break an API casually. Before changing public behavior, inspect tests, README examples, and package exports, and consider semver impact. Do not rename or remove public APIs as incidental cleanup.

Kern 1.x APIs are stable. Follow `packages/kern/SEMVER.md` for every public runtime or type change,
and document consumer-visible changes in `packages/kern/CHANGELOG.md`.

## Documentation

Update README/API documentation when adding or materially changing public behavior. Use realistic TypeScript examples such as `formatMoney(1999, "EUR")`. Document important units, mutation behavior, thrown errors, locale behavior, and timezone semantics.

Documentation interface icons must come from the `lucide-astro` package. Do not use emoji,
Unicode glyphs, or hand-written SVG markup as interface icons.

## Agent behavior

Agents working here should:

1. Inspect the existing architecture before implementing.
2. Reuse established patterns.
3. Avoid unrelated broad refactors.
4. Preserve public APIs unless explicitly asked to change them.
5. Add tests for new behavior.
6. Run relevant checks.
7. Report failures rather than hiding them.
8. Avoid dependencies without explicit approval.
9. Avoid generated boilerplate when a small implementation is sufficient.
10. Leave the repository compiling and tested.
11. Keep relevant correctness tests and performance benchmarks synchronized with runtime changes.

For ambiguity, prefer the option that is smaller, simpler, more predictable, more native, more type-safe, and easier to tree-shake.

## Definition of done

At minimum, applicable code changes require:

```bash
bun run typecheck
bun run test
```

For runtime or package changes also run:

```bash
bun run build
bun run size
bun run benchmark:quick
```

Compatibility claims target TypeScript 5+, Node.js 22+, Bun 1.3+, current Deno, and modern
evergreen browsers. CI owns the Node 22/24/26, minimum Bun 1.3/latest stable Bun, and current Deno
matrix; local `bun run check` owns the minimum/current TypeScript, current Node, Bun, browser, audit,
package, example, coverage, lint, build, and size gates.

For substantial repository-wide changes run `bun run check`. For any performance-sensitive or
input-scaling runtime change, run the relevant full benchmark suite before and after the change.

Do not state that a task is complete while known checks fail unless the failure is unrelated and clearly reported. Maintaining this root `AGENTS.md` is part of repository setup: keep its package name, commands, and structure synchronized with the actual project.
