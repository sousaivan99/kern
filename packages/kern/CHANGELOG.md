# Changelog

All notable changes to `@sousaivan/kern` are recorded here. Kern follows
[Semantic Versioning](./SEMVER.md), and each published version is immutable.

## [Unreleased]

No unreleased changes yet.

## [1.0.0] - 2026-08-14

### Added

- Zero-runtime-dependency ESM entrypoints for validation, money, date, number, string, array,
  object, and async helpers.
- Synchronous Standard Schema V1 support for every Kern schema, including distinct input and
  output inference for transforms and defaults.
- Exact safe-integer minor-unit money arithmetic, allocation, localized formatting, and parsing.
- Non-mutating local-calendar date arithmetic with a guarded native Temporal implementation and a
  native `Date` fallback for Node 22/24, Bun, and other runtimes without complete Temporal support.
- Seeded property and fuzz coverage for money, hostile validation input, Unicode strings, and
  calendar/DST boundaries.
- Complete beginner-oriented module guides, advanced options, runnable `console.log()` examples,
  generated API reference, framework tutorials, and compatibility fixtures.
- CI coverage for TypeScript 5 and current TypeScript, Node 22/24/26, Bun 1.3/current, current Deno,
  Chromium, supported timezones, package contents, bundle budgets, and dependency auditing.

[Unreleased]: https://github.com/sousaivan99/kern/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sousaivan99/kern/releases/tag/v1.0.0
