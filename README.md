# Kern

Kern is a Bun workspace for `@kern/core`, a zero-runtime-dependency, TypeScript-first collection
of small semantic primitives for modern JavaScript runtimes. Version 1.x is the stable public API
line and follows the package's semantic-versioning and support policies.

## Workspace

```text
apps/docs/       Astro, Starlight, and Tailwind documentation site
packages/kern/   Publishable @kern/core package and its tests
tooling/         Build, package, compatibility, benchmark, and repository automation
```

The library remains ESM-only, side-effect free, framework-agnostic, and split into independently
importable modules for validation, money, date, number, string, array, object, and async control
flow. See [`packages/kern/README.md`](./packages/kern/README.md) for the npm-facing package guide or
[`apps/docs/src/content/docs`](./apps/docs/src/content/docs) for the complete documentation source.

## Start here

The documentation is written as a progressive guide: begin with installation, follow one complete
order example, then learn the six shared ideas before choosing a module. Every module guide lists
its functions, options, defaults, return values, errors, mutation behavior, edge cases, and native
equivalents where relevant.

- [Installation](./apps/docs/src/content/docs/getting-started/installation.md)
- [Quick start](./apps/docs/src/content/docs/getting-started/quick-start.md)
- [Core ideas](./apps/docs/src/content/docs/getting-started/core-ideas.md)
- [JavaScript and TypeScript](./apps/docs/src/content/docs/frameworks/javascript-typescript.md)
- [Vue](./apps/docs/src/content/docs/frameworks/vue.md)
- [Nuxt](./apps/docs/src/content/docs/frameworks/nuxt.md)
- [React](./apps/docs/src/content/docs/frameworks/react.md)
- [Validation](./apps/docs/src/content/docs/modules/validation/index.md)
- [Money](./apps/docs/src/content/docs/modules/money/index.md)
- [Date](./apps/docs/src/content/docs/modules/date/index.md)
- [Number](./apps/docs/src/content/docs/modules/number.mdx)
- [String](./apps/docs/src/content/docs/modules/string.mdx)
- [Array](./apps/docs/src/content/docs/modules/array.mdx)
- [Object](./apps/docs/src/content/docs/modules/object.mdx)
- [Async](./apps/docs/src/content/docs/modules/async.mdx)

## Development

```bash
bun install
bun run dev
bun run test
bun run typecheck
bun run build
bun run docs:a11y
bun run docs:check
bun run package:check
bun run check
```

`bun run check` is the full local release gate across the package, documentation, compatibility
targets, packed artifact, bundle budgets, benchmarks, and dependency audit.
`bun run docs:a11y` rebuilds the site and checks every generated route in light and dark themes.

## Repository policy

- Runtime dependencies for `@kern/core`: **0**
- Package name: `@kern/core`
- Supported package runtimes: Node.js 22+, Bun 1.3+, current Deno, and modern evergreen browsers
- License: [MIT](./LICENSE)
- Security reports: [SECURITY.md](./SECURITY.md)
- Changelog: [packages/kern/CHANGELOG.md](./packages/kern/CHANGELOG.md)
- Semantic versioning: [packages/kern/SEMVER.md](./packages/kern/SEMVER.md)
- Support: [packages/kern/SUPPORT.md](./packages/kern/SUPPORT.md)
- Releases: [packages/kern/RELEASING.md](./packages/kern/RELEASING.md)
