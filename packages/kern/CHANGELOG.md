# Changelog

All notable changes to `@sousaivan/kern` are recorded here. Kern follows
[Semantic Versioning](./SEMVER.md), and each published version is immutable.

## [Unreleased]

## [1.1.0] - 2026-08-24

### Added

- Added immutable `array(schema).min()`, `.max()`, and `.length()` validation constraints with
  structured size issues, aggregate element validation, and inferred `ArraySchema` chaining.
- Added `unknown()` for required or modified opaque validation fields while preserving exact input
  identity, plus `withoutNullish()` for order-preserving `NonNullable<T>` array filtering.

### Changed

- Made the authoritative `bun run check` dependency-aware and bounded-concurrent, with one package
  build, one documentation build, reusable packed artifacts, captured diagnostics, and clean
  cancellation of dependent work.
- Centralized public module ownership, gzip budgets, documentation routes, and benchmark categories
  in a drift-audited tooling manifest.
- Standardized maintained repository and release references on `develop` to `prod`, and centralized
  release-version, changelog, tag, and npm availability validation.
- Expanded nightly property coverage, packed Node/Bun/Deno execution, multi-engine browser smoke,
  documentation worker pools, API benchmarks, and consumer-facing project guidance.

### Fixed

- Date-producing arithmetic and day-boundary helpers now throw
  `RangeError("Date result is outside the supported range")` instead of returning invalid dates,
  consistently across native and Temporal-backed paths.

## [1.0.1] - 2026-08-18

### Changed

- Improved successful validation throughput with pollution-safe object construction, snapshotted
  object fields, allocation-light internal failures, reusable issue paths, and flattened primitive
  checks while preserving issue aggregation and Standard Schema behavior.
- Added bounded formatter caching for eligible number, relative-time, and explicit-time-zone date
  configurations, plus bounded formatter/parser caching for money; system-time-zone and observable
  option objects continue to use fresh formatters.
- Reduced repeated graph traversal in `deepFreeze`, streamed grapheme truncation, and added an exact
  allocation fast path for money ratios without changing their public results. Reduced temporary
  Unicode arrays and intermediate casing pipelines in `capitalize`, `uncapitalize`, and `camelCase`,
  pre-sized large `chunk` outputs while retaining native `slice` observability, and stabilized the
  hot `partition` and `hasOwn` paths without changing their results.
- Added guarded fast paths for descriptor-preserving `pick`/`omit`, ordinary decimal rounding,
  clamped native-Date month arithmetic, default money multiplication, and cached `once` results.
  Ambiguous rounding, custom money modes, accessors, non-default descriptors, Temporal, and thrown
  callback behavior retain their existing diagnostic or exact paths.
- Expanded benchmark coverage and reproducibility metadata, including verified per-module
  comparisons with pinned array, object, string, number, date, money, and async competitors. Its
  equal-weight score is explicitly diagnostic and non-gating.
- Reduced runtime code without changing public types or semantics: validation now avoids redundant
  field scans and issue helpers, `record()` uses one pollution-safe output finalization, money
  modules share exact safety guards, date comparisons reuse validated timestamps, and duplicate
  date/Temporal/formatter and unreachable async/path state were removed.
- Added a printable-ASCII casing/truncation path and a guarded two-decimal rounding path. Unicode
  grapheme behavior and ambiguous decimal ties retain their existing fallbacks; three rotated full
  runs place every selected string workload and rounding within 10% of the fastest competitor.

### Fixed

- Preserved already-bounded Unicode strings when a multi-code-unit grapheme fits the requested
  truncation length, even when the omission itself fills that length.

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

[Unreleased]: https://github.com/sousaivan99/kern/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/sousaivan99/kern/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/sousaivan99/kern/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/sousaivan99/kern/releases/tag/v1.0.0
