---
title: Development
description: Set up the Kern workspace and understand every focused and full verification command.
---

This page is for contributors working on Kern itself. Applications that only consume Kern should
start with [Installation](../../getting-started/installation/).

## Repository layout

```text
apps/docs/       Documentation site and visual/accessibility checks
packages/kern/   Published @sousaivan/kern source, tests, and package metadata
tooling/         Build, benchmark, compatibility, and repository scripts
```

Runtime source belongs under `packages/kern/src/<module>/`. Documentation guides follow the same
module boundaries under `apps/docs/src/content/docs/modules/`.

## Install the workspace

Kern uses Bun workspaces:

```bash
bun install
```

The install includes development-only tools such as TypeScript, Biome, Astro, and the browser used
by compatibility/accessibility tests. None are runtime dependencies of `@sousaivan/kern`.

## Day-to-day commands

| Command | Use it for |
| --- | --- |
| `bun run dev` | Start the documentation development server. |
| `bun run test` | Run runtime tests once. |
| `bun run test:watch` | Re-run tests interactively while editing. |
| `bun run typecheck` | Check the current TypeScript compiler. |
| `bun run typecheck:minimum` | Check the minimum supported TypeScript 5.0 compiler. |
| `bun run lint` | Check Biome rules without rewriting files. |
| `bun run format` | Format supported files. |
| `bun run build` | Build ESM bundles, source maps, and declarations. |
| `bun run size` | Bundle/minify/gzip every entrypoint and enforce budgets. |
| `bun run size:report` | Regenerate the versioned package-size report used by the docs. |
| `bun run benchmark:quick` | Verify benchmark fixtures and smoke the harness. |
| `bun run benchmark` | Run the complete benchmark suite. |

Start with the smallest checks relevant to your change. Runtime changes require at least tests,
type checking, build, size, and benchmark smoke.

## Documentation commands

| Command | Checks |
| --- | --- |
| `bun run docs:snippets` | Every TypeScript fence with TypeScript 5.0 and current. |
| `bun run docs:a11y` | Every generated route, light/dark accessibility, and contrast. |
| `bun run docs:check` | TypeDoc, links/build, snippets, browser smoke, and accessibility. |

Write every TypeScript code fence as a complete standalone example. The snippet checker compiles
each fence in isolation so readers can copy it without relying on an earlier hidden variable.

Guide pages should explain:

1. what the API solves;
2. the simplest correct example;
3. every Kern-specific option and default;
4. return values and TypeScript inference;
5. thrown errors and expected failures;
6. mutation, locale, timezone, unit, and security boundaries;
7. the native equivalent when the helper is a readability wrapper.

## Compatibility and package checks

| Command | Checks |
| --- | --- |
| `bun run test:timezones` | Date behavior across representative host timezones. |
| `bun run test:compat` | Current supported server runtime smoke. |
| `bun run test:browser` | Browser-targeted bundle in Chromium. |
| `bun run package:check` | Packed npm artifact, exports, declarations, and examples. |
| `bun run audit` | Dependency vulnerability audit. |
| `bun run pack:dry` | Show files that would be published without publishing. |

CI owns the Node 22/24/26, minimum Bun 1.3/latest stable Bun, and current Deno matrix. Local checks
cover the pinned Bun and Node versions, browser behavior, minimum/current TypeScript, and the packed
artifact.

## The full gate

```bash
bun run check
```

This is the complete local release gate. It runs formatting/linting, both TypeScript versions,
coverage, build, size, benchmark fixtures, documentation, timezones, runtimes, browser, packed
package, and audit checks. Successful subprocess output is collapsed; a failure prints the original
captured output.

Run it before considering a substantial change complete.

## Adding or changing a public helper

Before adding an API, confirm that it removes meaningful boilerplate, improves narrowing, or
prevents a common correctness mistake. Native JavaScript should remain the first choice when it is
already small and clear.

For an accepted public change:

1. implement it in the narrowest module;
2. export it from that module;
3. add runtime tests for success, failure, edge cases, and immutability;
4. add type tests when inference changes;
5. document the complete beginner and advanced contract;
6. update package/browser/runtime smoke coverage;
7. add a benchmark only when work scales with input or is performance-sensitive;
8. run the applicable focused checks and `bun run check`.

Kern 1.x is stable. Review runtime and TypeScript changes against the package's semantic-versioning
policy, update the changelog for consumer-visible behavior, and use a major version for breaking
changes. Deprecate a public API in a prior minor release when practical.
