# `@sousaivan/kern`

[![npm](https://img.shields.io/npm/v/@sousaivan/kern)](https://www.npmjs.com/package/@sousaivan/kern)
[![CI](https://github.com/sousaivan99/kern/actions/workflows/ci.yml/badge.svg?branch=prod)](https://github.com/sousaivan99/kern/actions/workflows/ci.yml)
[![dependencies](https://img.shields.io/badge/runtime_dependencies-0-2ea44f)](./packages/kern/package.json)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Kern is a small, TypeScript-first utility package for validation, exact minor-unit money,
calendar-safe dates, arrays, objects, strings, numbers, and cancellable async control flow. It is
ESM-only, framework-agnostic, side-effect free, tree-shakeable, and has zero runtime dependencies.

[Read the live documentation](https://sousaivan99.github.io/kern/) ·
[Browse the package guide](./packages/kern/README.md) ·
[See package sizes](https://sousaivan99.github.io/kern/measurements/package-size/)

## Install

```bash
npm install @sousaivan/kern
bun add @sousaivan/kern
pnpm add @sousaivan/kern
yarn add @sousaivan/kern
```

Prefer focused subpath imports so ownership and tree-shaking stay obvious:

```ts
import { withoutNullish } from "@sousaivan/kern/array"
import { formatMoney, sumMoney } from "@sousaivan/kern/money"
import { array, number, object, string, unknown } from "@sousaivan/kern/validation"

const Request = object({
  customer: string().trim().min(2),
  prices: array(number().integer()).min(1),
  metadata: unknown().optional(),
})

const request = Request.parse(input)
const total = sumMoney(withoutNullish(request.prices))
console.log(formatMoney(total, "EUR", { locale: "en-IE" }))
```

Validation failures are structured and inferred. Money values are safe-integer minor units such
as cents. Date helpers do not mutate their input, and every public module has an enforced gzip
budget.

## Choose Kern when

- You want a compact, dependency-free foundation instead of a large general-purpose toolkit.
- Type inference, structured validation errors, exact money arithmetic, and tree-shaking matter.
- Native JavaScript and Web APIs should remain visible rather than hidden behind a framework.
- Node 22+, Bun 1.3+, current Deno, and evergreen browsers cover your runtime targets.

## Choose something else when

- You need exhaustive Lodash, Zod, or date-fns compatibility and their broader ecosystems.
- You need time-zone database arithmetic, foreign exchange, a ledger, or locale data bundled in.
- You require CommonJS, legacy browsers, or older Node versions.
- Your application needs recursive/discriminated schemas or domain-specific validation primitives.

## Repository

The published package is in [`packages/kern`](./packages/kern), documentation is in
[`apps/docs`](./apps/docs), and build/benchmark automation is in [`tooling`](./tooling). Kern 1.x
follows the package [SemVer policy](./packages/kern/SEMVER.md) and
[support policy](./packages/kern/SUPPORT.md).

```bash
bun install
bun run check
```

`bun run check` is the one complete local gate. It runs the full correctness, type, package,
runtime, browser, documentation, accessibility, bundle-size, benchmark-smoke, and audit coverage
through a bounded dependency-aware workflow.

Development flows from `develop` to the protected `prod` release branch. See
[CONTRIBUTING.md](./CONTRIBUTING.md), [ROADMAP.md](./ROADMAP.md), and
[RELEASING.md](./packages/kern/RELEASING.md).

MIT © Ivan Sousa.
