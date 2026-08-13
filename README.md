# Kern

Kern is a Bun workspace for `@kern/core`, a zero-runtime-dependency, TypeScript-first collection
of small semantic primitives for modern JavaScript runtimes. The repository is in unreleased MVP
development; the finished MVP will be the first 1.0 release.

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
