# AGENTS.md

## Project overview

Kern is a zero-runtime-dependency, TypeScript-first, framework-agnostic, ESM-first, tree-shakeable, Bun-based utility toolkit. It provides small primitives commonly replaced by dependencies such as Zod, Lodash, date-fns, and money utility libraries.

> Bundle size is a feature of this project, not an afterthought.

The temporary npm package name is `@kern/core`; the repository name is `kern`.

## Core principles

1. Do not add runtime dependencies.
2. Prefer native JavaScript and Web APIs.
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
bun run example
bun run package:check
bun run audit
```

Run relevant checks after modifying code. For substantial changes, prefer `bun run check` before considering the task complete.

## Repository structure

```text
src/
├── validation/
├── money/
├── date/
├── number/
├── string/
├── array/
├── object/
└── async/
```

### validation

Owns runtime schemas, parsing, safe parsing, structured validation errors, refinements, transformations, optional/default/nullability behavior, and TypeScript inference. Do not introduce application-specific validation concepts.

### money

Owns minor-unit-first monetary helpers. Avoid floating-point arithmetic where integer arithmetic is possible, rely on `Intl.NumberFormat` for formatting, and keep currency units unambiguous.

### date

Owns small native `Date`/`Intl` utilities. Do not mutate supplied dates or pretend timezone arithmetic is trivial. Keep formatting and calendar arithmetic clearly separated.

### number

Owns small numeric calculations and native number formatting helpers.

### string

Owns only high-value string operations. Do not grow it into a general-purpose Lodash replacement.

### array

Owns small collection operations where the native alternative is meaningfully more cumbersome.

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
- Transforms must preserve inferred output types.
- Optional, default, and nullability semantics must be predictable.
- Avoid needless allocations in hot paths.
- Avoid deep inheritance trees unless clearly justified.

## Native-first policy

Before implementing a helper, check whether modern runtimes already provide it. Prefer `Intl`, `URL`, `URLSearchParams`, `crypto`, `structuredClone`, `AbortController`, `AbortSignal`, `Promise`, `Map`, `Set`, `Object`, and `Array`.

Do not wrap native APIs merely to grow the API. For example, do not add:

```ts
export const map = <T, R>(array: T[], fn: (value: T) => R) => array.map(fn)
```

## Bundle-size policy

Approximate targets:

```text
validation     < 5 KB gzip
money          < 2 KB gzip
date           < 2 KB gzip
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

## Type safety

Do not weaken public types to solve local implementation problems. Avoid casually introducing `any`, `as any`, `// @ts-ignore`, or `// @ts-nocheck`. Keep necessary casts narrow and local. Public APIs should infer without manual generic arguments.

When changing schema types, verify both runtime behavior and compile-time inference.

## Performance

Do not prematurely optimize small helpers. Validation is the primary performance-sensitive module. When changing validation internals:

- avoid repeated object creation where practical;
- avoid unnecessary exception handling on successful paths;
- avoid repeatedly rebuilding static metadata;
- measure rather than speculate.

Run `bun run benchmark` for material validation changes. Comparisons must be fair; never remove validation, safety, or useful error information merely to improve a number.

## Coding style

Prefer small focused functions, explicit names, early returns, immutable behavior, straightforward control flow, useful `readonly`, discriminated unions, and simple data structures.

Avoid unnecessary classes, factories wrapping factories, excessive generics, clever type-level programming without substantial API benefit, giant files, speculative abstractions, and generic dumping grounds. Do not create `helpers.ts`, `common.ts`, `misc.ts`, or `utils.ts` without a clear narrow ownership boundary.

## Adding features

Before adding a helper or module, answer internally:

1. Is this commonly reimplemented?
2. Is the native API insufficient or unnecessarily cumbersome?
3. Can this remain very small?
4. Does it belong in an existing module?
5. Will users understand the behavior from its name?
6. Is it worth maintaining permanently?

If not, do not add it.

## Backward compatibility

Once released, do not break an API casually. Before changing public behavior, inspect tests, README examples, and package exports, and consider semver impact. Do not rename or remove public APIs as incidental cleanup.

## Documentation

Update README/API documentation when adding or materially changing public behavior. Use realistic TypeScript examples such as `formatMoney(1999, "EUR")`. Document important units, mutation behavior, thrown errors, locale behavior, and timezone semantics.

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
```

Compatibility claims target TypeScript 5+, Node.js 22+, Bun 1.3+, current Deno, and modern
evergreen browsers. CI owns the complete Node 22/24 and Deno matrix; local `bun run check` owns the
minimum/current TypeScript, current Node, Bun, browser, audit, package, example, coverage, lint,
build, and size gates.

For substantial repository-wide changes run `bun run check`. For validation performance changes run `bun run benchmark`.

Do not state that a task is complete while known checks fail unless the failure is unrelated and clearly reported. Maintaining this root `AGENTS.md` is part of repository setup: keep its package name, commands, and structure synchronized with the actual project.
