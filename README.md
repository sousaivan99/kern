# Lithekit

[![CI](https://github.com/sousaivan99/lithekit/actions/workflows/ci.yml/badge.svg?branch=prod)](https://github.com/sousaivan99/lithekit/actions/workflows/ci.yml)
[![dependencies](https://img.shields.io/badge/runtime_dependencies-0-2ea44f)](./tooling/config/packages.json)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Lithekit is a TypeScript-first ecosystem of small, independently installable packages for
validation, exact minor-unit money, dates, numbers, strings, collections, async control flow, and
native schema-driven forms. Packages are ESM-only, tree-shakeable, and have no runtime dependencies
except Form adapters depending on Form core.

[Read the documentation](https://sousaivan99.github.io/lithekit/) ·
[See package sizes](https://sousaivan99.github.io/lithekit/measurements/package-size/) ·
[Migrate from Kern](./apps/docs/src/content/docs/getting-started/migrate-from-kern.md)

## Install only what you use

```bash
npm install @lithekit/validation @lithekit/money
```

```ts
import { object, string } from "@lithekit/validation"
import { formatMoney } from "@lithekit/money"

const User = object({ name: string().trim().min(2) })
const user = User.parse({ name: " Ada " })

formatMoney(1999, "EUR")
```

There is deliberately no `@lithekit` or `@lithekit/core` aggregate package.

| Package | Purpose |
| --- | --- |
| `@lithekit/validation` | Fluent inferred Standard Schema validation |
| `@lithekit/money` | Exact minor-unit formatting, parsing, rounding, and allocation |
| `@lithekit/date` | Native `Date`, `Intl`, and available `Temporal` helpers |
| `@lithekit/number` | Numeric calculations and formatting |
| `@lithekit/string` | Focused string operations |
| `@lithekit/array` | Small collection operations |
| `@lithekit/object` | Safe object operations |
| `@lithekit/async` | Promise, retry, timing, and control flow |
| `@lithekit/form` | Framework-neutral DOM form controller |
| `@lithekit/form-vue` | Vue 3.3+ composables; installs no React code |
| `@lithekit/form-react` | React 18+ hooks and `<Form>`; installs no Vue code |

## Development

```bash
bun install
bun run check
```

Package contracts, paths, budgets, release order, and framework peers live in
[`tooling/config/packages.json`](./tooling/config/packages.json). Each published package owns its
README, changelog, SemVer policy, support policy, license, tests, and declaration build.

The repository was renamed from Kern while retaining its history and tags. Published Kern artifacts
are not removed or replaced with a compatibility wrapper.
