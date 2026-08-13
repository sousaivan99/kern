---
title: Development
description: Work on the Kern package, documentation, tests, benchmarks, and release checks.
---

Install all Bun workspaces from the repository root:

```bash
bun install
```

Useful commands:

```bash
bun run dev
bun run test
bun run typecheck
bun run build
bun run size
bun run benchmark:quick
bun run docs:a11y
bun run docs:check
bun run package:check
bun run check
```

`bun run check` is the complete local gate. It verifies formatting and linting, current and minimum
TypeScript, coverage, builds, size budgets, benchmark fixtures, documentation, timezones, runtime
compatibility, the browser bundle, the packed npm artifact, and the dependency audit.
Use `bun run docs:a11y` for the focused all-route light/dark WCAG and contrast gate.

## Adding a public helper

Add it to the smallest appropriate module, export it from that module, document its full contract,
and cover runtime behavior plus inferred types. Add a benchmark only when work scales with input or
the path is performance-sensitive. Runtime changes must preserve the package's zero-dependency and
side-effect-free guarantees.
