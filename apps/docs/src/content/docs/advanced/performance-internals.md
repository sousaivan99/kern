---
title: Performance internals
description: How Kern reduces hot-path work while preserving validation, prototype, money, Intl, and type-safety contracts.
---

Kern is fast because common successful operations do less work, not because public behavior is
removed. The implementation keeps diagnostic, security, exactness, and compatibility paths for the
cases that need them.

Performance claims still come from measurement. Read the
[validation comparison](../../measurements/validation-benchmarks/) and
[runtime measurements](../../measurements/runtime-benchmarks/), plus the
[module comparisons](../../measurements/module-benchmarks/), for workloads, versions, raw artifact
hashes, and reproduction commands.

## The performance contract

An optimization is acceptable only when it preserves all of these boundaries:

- successful output and TypeScript inference;
- issue codes, paths, order, aggregation, and limits;
- callback and input-accessor exception isolation;
- prototype-pollution resistance and dangerous property names;
- exact minor-unit money arithmetic and configured rounding;
- current default-time-zone behavior;
- public array observability where Kern delegates to native operations;
- zero runtime dependencies, tree-shaking, and entrypoint gzip budgets.

This is why Kern has fast and diagnostic paths rather than one benchmark-specific implementation.

## Validation: construction once, minimal success work

### 1. Schemas snapshot static metadata

`object(shape)` copies the caller's shape when the schema is created. Keys and internal field
validators are derived from that snapshot and reused. Parsing does not repeatedly enumerate the
caller's shape or rebuild field metadata, and later mutation of the caller's object cannot change an
existing schema.

Composition remains immutable: `pick`, `omit`, `partial`, and `extend` create new schemas. Kern does
not need a per-parse shape identity check to support undocumented live mutation.

### 2. Internal validators return data or one sentinel

Public `safeParse()` must return a discriminated result object. Nested validators do not need that
wrapper. Internally, a successful validator returns its parsed value and a failed validator returns
one private `FAILURE` symbol.

This removes `{ success, data }` allocations at every successful primitive, property, modifier, and
array element. `parse()` can return the internal value directly. `safeParse()` creates its public
success or failure object only at the schema boundary.

The sentinel cannot be confused with valid `undefined` output or with an arbitrary symbol supplied
by a caller because it is a private symbol with identity semantics.

### 3. Common object shapes receive fixed fast validators

Required, stripping object schemas whose fields all support fast validation can use a success path
assembled when the schema is created. One-, two-, and three-field schemas use fixed property reads
and fixed object-literal output. Larger and composed schemas use a generic field loop.

The three-field `safeParse()` path validates all three fields without allocating a diagnostic
context on success. If any field fails, it creates the context and runs the diagnostic field
validators needed to produce the normal aggregated issues.

This is still Kern's ordinary interpreter. It does not generate source code, use `eval`, require a
build plugin, or change the public schema value.

### 4. Successful paths and diagnostic paths share semantics

Fast primitive validators cover type checks and built-in string/number constraints. Optional,
nullable, and default modifiers compose those validators without creating a success wrapper.
User-provided refinements and transforms retain the diagnostic validator because callbacks may fail
or throw and must preserve operation order.

If a fast validation fails, Kern uses the full validator to construct the same issue information a
consumer expects. A throwing input getter is converted to `validation_exception`, including its
nested property path, rather than escaping or being read repeatedly for diagnostics.

### 5. Paths are copied only when an issue exists

Nested collections reuse one mutable path stack. They push a property name or array index before
entering a child and pop it afterward. Issue emission copies the current stack only when an issue
is created.

Successful traversal therefore avoids allocating a path array at every level. Union candidates
receive isolated issue/path state, so a rejected alternative cannot contaminate the accepted
alternative or later issues.

### 6. Safe output construction avoids inherited setters

The generic object path writes into `Object.create(null)`. A null-prototype object has no inherited
setter for `__proto__` or for a property injected into `Object.prototype`. Only after every field
succeeds does Kern restore `Object.prototype` once with `Object.setPrototypeOf`.

`record()` uses the same construction boundary for arbitrary keys. It validates and writes own
properties while the output has no prototype, then restores the ordinary prototype once after the
entire record succeeds. This protects names such as `__proto__` and names backed by hostile
inherited setters without paying for one descriptor definition per accepted entry.

The tiny fixed-field paths use object literals with computed own properties. Kern never performs
plain assignment into an output that already inherits potentially hostile setters. This safety
boundary is part of the measured work.

## `Intl`: cache expensive native constructors conservatively

Constructing `Intl.NumberFormat`, `Intl.DateTimeFormat`, and locale-specific money parsing metadata
is much more expensive than calling an existing formatter. Kern uses separate lazy caches for
number, relative-time, explicit-time-zone date, money-format, and money-parse configurations.

Each cache has these rules:

1. It allocates its `Map` only after the first eligible use.
2. It holds at most 32 entries and refreshes recency on a hit.
3. It canonicalizes the current option values on every call; caller object identity is not a key.
4. It accepts only plain or null-prototype option objects with enumerable data properties, no
   symbols, and already-valid primitive values.
5. Accessors, coercible objects, unusual prototypes, proxies that reject inspection, and
   normalization failures bypass caching.
6. Reaching the 32-entry boundary evicts the least-recent entry and temporarily bypasses caching
   during sustained churn, avoiding repeated creation and eviction work.

Date formatting without an explicit `timeZone` always bypasses the cache. A formatter captures the
runtime's default zone when constructed; retaining it could return stale results after a system
timezone change.

These rules are why the warm rows are fast without turning mutable caller options or native global
state into stale cached output. Cold, 33-key boundary, 128-key churn, forced-GC heap, and RSS plateau
measurements guard the other side of the tradeoff.

## Money: fast common arithmetic, exact fallback

Money remains minor-unit-first and validates safe integers.

### Exact allocation

`allocateMoney` first validates ratios while accumulating a safe numeric total. When the absolute
amount divides exactly by that total, the result is a simple numeric scale of each weight. This is
the common equal-share benchmark path and avoids creating thousands of `bigint` numerators and
remainder records.

If division has a remainder, the total exceeds the safe integer range, or proportional ranking is
needed, Kern uses the exact `bigint` implementation. It distributes remaining units by descending
remainder with stable input-order ties, then checks every result when converting back to numbers.
Negative and zero-weight allocations keep the same contract in both paths.

### Exact multiplication with a numeric fast path

Default `multiplyMoney()` calls first calculate the product as a number. When the product is safely
bounded and clearly separated from a half-unit rounding boundary, Kern can apply half-away-from-zero
rounding directly. Products near a boundary, large products, non-finite factors, and every explicit
rounding configuration use the original decimal-to-`bigint` path.

The shortcut is therefore a proof-based fast path, not a switch to floating-point money. Cases such
as `multiplyMoney(100, 1.005)` still take the exact path and return `101`; arbitrary rounding modes
and increments continue to use exact ratios.

### Formatting and parsing

Money formatting caches an eligible currency formatter together with its resolved minor-unit digit
count. The amount is converted to an exact decimal string before `Intl` formatting, avoiding a
floating-point minor-unit conversion.

Money parsing caches the currency's positive/negative affix patterns, localized digits, decimal and
group separators, grouping widths, and minor-unit precision. Each input is still checked against
the locale pattern and exact grouping rules. The final decimal is converted and rounded with
`bigint` arithmetic.

The cache removes repeated locale discovery; it does not weaken parsing or rounding.

The money entrypoint also shares its private safe-minor-unit and checked-`bigint`-conversion guards
across arithmetic, formatting, and parsing. That removes duplicated runtime code while keeping the
same safe-integer errors and exact conversion boundary. Invalid localized inputs converge on one
failure path after their observable checks have run.

## Strings: avoid whole-input intermediate arrays

`capitalize` and `uncapitalize` inspect only the first Unicode code point and append the untouched
remainder. They do not spread the entire string into a code-point array.

`camelCase` still performs Unicode normalization and word-boundary recognition, but assembles the
output in one loop instead of mapping the word list through multiple intermediate arrays.

`truncate` first returns immediately when UTF-16 length proves truncation unnecessary. When
truncation is required, printable ASCII input with a printable ASCII omission uses direct slicing:
every accepted code unit is exactly one grapheme, so no behavior is lost. Other input streams
`Intl.Segmenter` results and retains only the prefix that can appear in the output. It still counts
grapheme clusters and will not split joined emoji, regional indicators, CRLF, or combining
sequences.

Normalization and grapheme correctness remain intentional costs. Kern does not replace them with an
ASCII-only benchmark path.

## Arrays and objects: optimize inside observable contracts

`partition` uses one indexed pass and pushes each value directly into one of two stable output
arrays. It preserves input order and type-guard inference.

`chunk` preallocates its outer result when the observed length makes that possible, while retaining
native `slice` for each chunk. This preserves holes, array species, and native index behavior. The
implementation also re-reads length at the same observable points needed by its supported contract.

Object helpers deliberately make different tradeoffs:

- `hasOwn` rejects primitives without coercion, then delegates to native `Object.hasOwn`.
- `pick` and `omit` copy property descriptors instead of reading values, preserving accessors,
  symbols, enumerability, and writability.
- `deepFreeze` first traverses and validates the complete plain-object/array graph with a `WeakSet`.
  It freezes only after traversal succeeds, so unsupported accessors, functions, built-ins, or class
  instances cannot leave a partially frozen graph.

Those guarantees can cost more than a simplified loop. They were retained because a faster
different function is not an optimization of the existing API.

`pick` and `omit` now construct their output with a null prototype. Ordinary writable, enumerable,
configurable data descriptors can then use direct own assignment without consulting a polluted
`Object.prototype`. Accessors and non-default descriptors still use `Object.defineProperty`. After
a successful copy, Kern restores `Object.prototype` once when the source used it. This removes a
second lookup from `pick` and most per-property descriptor-definition calls without weakening the
hostile-setter boundary.

## Number and date arithmetic: guarded common paths

`round()` uses numeric scaling for ordinary finite values and common precisions. It measures the
scaled value's distance from a half-integer boundary; ambiguous ties, extreme precisions, overflow,
and underflow fall back to decimal exponent shifting. This preserves results such as `1.005 → 1.01`
without paying for two string conversions on every non-ambiguous call.

The common two-decimal path performs that proof before the generic precision validation pipeline.
For bounded values, a result farther than the conservative ambiguity band from a half-integer is
safe to return immediately. A deterministic 10,000-value regression compares this path with decimal
exponent shifting; boundary examples still take the exact fallback.

Native-Date month addition calculates the destination year, month, leap-year status, and clamped
day directly. It creates one result `Date` and performs one calendar write instead of creating a
second month-end `Date`. The guarded Temporal route remains available when a complete native
implementation exists, and seeded timezone/property tests compare the optimized fallback across
DST transitions, month ends, and years below 100.

Date comparisons reuse the timestamp produced by input validation instead of calling `getTime()`
again. `addYears()` validates the requested year/month range, converts it to months, and then uses
the same single calendar-arithmetic path as `addMonths()`. Kern caches a successfully validated
Temporal namespace directly, while every public operation remains inside its exception boundary
for incomplete or hostile implementations.

Relative-time unit metadata is created once at module initialization, and uncached date formatting
shares one cold formatter path. Date calls without an explicit `timeZone` still construct a fresh
formatter so a changed system timezone cannot be hidden by Kern's cache.

## Async controls: scalar cached state

`once()` stores its idle, running, returned, and thrown states as one scalar plus the cached result
or error. Repeated successful calls no longer inspect a freshly shaped state object. Kern still does
more than the smallest competitor implementation: it detects recursive invocation and permanently
caches a thrown error as documented. Retry and debounce already measured at parity or ahead, so
their cancellation and failure behavior was left intact.

The abortable `sleep()` path captures the already-validated signal used to register its listener.
Its abort handler no longer repeats an unreachable missing-signal fallback; cleanup, rejection
reason, and listener-removal behavior are unchanged.

## Type safety and bundle size

The fast validators, failure sentinel, path stack, and caches are private implementation details.
Public `Schema<Output, Input, Presence>`, `InferInput`, `InferOutput`, modifier inference, array
type-guard overloads, and money/string option types remain the source of consumer types.

Kern does not ship benchmark competitors or runtime dependencies. Every public entrypoint remains
independently bundleable, and runtime changes are checked against gzip budgets. The current measured
gzip sizes are 4,536 bytes for validation, 3,182 for money, 1,983 for date, 749 for object, 970 for
async, 1,269 for number, 903 for string, and 11,634 for the root export. These figures include the
safety and fallback paths described above. See the
[versioned package-size report](../../measurements/package-size/) for every entrypoint and the
reproduction command.

## Optimizations that were rejected

Measurement and compatibility review also prevent unnecessary complexity:

- Batched object property descriptors made measured `pick` and `omit` cases slower, so descriptor
  copying stayed simple.
- Copy-then-delete object output, null-prototype omission maps, and alternate `once()` state layouts
  were also slower. Kern retained the existing descriptor and cached-success paths.
- An additional `deepFreeze` shortcut did not improve beyond the measured noise band, so it was
  removed.
- Eagerly caching another validation-field array reduced a small amount of source but produced
  unstable construction/JIT measurements, so Kern retained the simpler field snapshot.
- Assigning fields directly into a normal `{}` output was rejected because inherited setters can
  observe or replace the write.
- Caching date formatters without an explicit timezone was rejected because the system default can
  change.
- Native array behavior was retained wherever a rewrite would change holes, species, captured
  length, inherited indices, overridden methods, or proxy observations.

The general rule is simple: fewer allocations and less repeated static work are valuable; weaker
semantics are not.

## Read and reproduce

- [Validation schema boundary](https://github.com/sousaivan99/kern/blob/main/packages/kern/src/validation/schema.ts)
- [Collection validators and safe output construction](https://github.com/sousaivan99/kern/blob/main/packages/kern/src/validation/collections/index.ts)
- [`Intl` normalization and bounded caches](https://github.com/sousaivan99/kern/blob/main/packages/kern/src/intl.ts)
- [Exact money allocation](https://github.com/sousaivan99/kern/blob/main/packages/kern/src/money/arithmetic.ts)
- [String hot paths](https://github.com/sousaivan99/kern/blob/main/packages/kern/src/string/index.ts)
- [Benchmark methodology and report command](https://github.com/sousaivan99/kern/blob/main/tooling/benchmarks/README.md)

Use the stable scenario IDs from the measurement pages with `bun run benchmark:report`. The report
rejects source, runtime, fixture, or run-order mismatches before calculating a median of run medians.
