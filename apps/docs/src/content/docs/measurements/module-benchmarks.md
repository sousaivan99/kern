---
title: Module comparison benchmarks
description: Reproduce fair per-operation comparisons for Kern array, object, string, number, date, money, and async modules.
---

This page compares Kern's non-validation modules with libraries that expose closely related public
operations. It reports every selected workload, including cases Kern does not win. Lower latency is
better. The aggregate benchmark score is diagnostic only and is not used for an overall ranking.

The comparison adds development-only packages under `tooling/`. Kern still has zero runtime
dependencies, and these competitors do not enter any published bundle.

## At a glance

The frozen snapshot contains 23 scenarios and 69 independently timed adapters. Each value is the
median of three full runs with a rotated library order. These are workload-specific results, not a
single library-wide ranking.

| Workload where Kern leads | Latency reduction | Equivalent throughput |
| --- | ---: | ---: |
| Truncate printable ASCII to 32 characters vs es-toolkit | 17.1% lower | 1.21× |
| Add minor-unit money values | 96.9% lower | 32.77× |
| Multiply money by 1.15 | 75.3% lower | 4.05× |
| Allocate money across eight ratios | 50.0% lower | 2.00× |
| Difference in calendar days | 74.7% lower | 3.96× |
| Add one clamped calendar month | 46.9% lower | 1.88× |
| Retry until the third attempt | 58.7% lower | 2.42× |

Kern does not lead every selected intersection. The same frozen runs expose the current gaps rather
than hiding them:

| Workload where a competitor leads | Kern latency relative to the winner | Relevant contract difference |
| --- | ---: | --- |
| Pick 100 of 1,000 object properties | 1.44× | Kern preserves property descriptors |
| Omit 100 of 1,000 object properties | 1.48× | Kern preserves property descriptors |
| Add 10 local-calendar days | 1.06× | Kern validates safe-integer amounts and supports guarded native Temporal |
| Read a cached `once` result | 1.42× | Kern also caches thrown errors and detects recursive invocation |

The remaining string and number rows are inside the suite's 10% near-tie band: `kebabCase` is 1.07×
the es-toolkit latency, printable-ASCII truncation is 1.04× the fastest absolute result while beating
es-toolkit, and exact two-decimal rounding is 1.09× es-toolkit's unconditional binary-scaling path.

The competitor packages remain development-only. The package size gate passed after adding the
benchmark and documentation infrastructure:

| Kern entrypoint | Minified + gzip | Budget |
| --- | ---: | ---: |
| Validation | 4,536 B | 5,120 B |
| Money | 3,182 B | 3,200 B |
| Date | 1,983 B | 2,048 B |
| Number | 1,269 B | 1,500 B |
| Array | 532 B | 1,500 B |
| String | 903 B | 2,048 B |
| Object | 749 B | 2,048 B |
| Async | 970 B | 2,500 B |

The detailed tables below provide the absolute timings, exact competitors, semantic notes, and
reproduction commands behind this summary.

## Competitors

| Kern module | Compared libraries | Why these operations were selected |
| --- | --- | --- |
| Array, object, string, number | [es-toolkit](https://es-toolkit.dev/) 1.50.0 and [Lodash](https://lodash.com/docs/) 4.18.1 | Both publish matching collection, object-copy, case-conversion, truncation, and numeric helpers. |
| Date | [date-fns](https://date-fns.org/) 4.4.0 and [Day.js](https://day.js.org/en/) 1.11.22 | Both provide immutable calendar arithmetic and boundary operations. |
| Money | [Dinero.js](https://www.dinerojs.com/) 2.0.2 and [currency.js](https://currency.js.org/) 2.0.4 | Both operate on integer-backed monetary values and expose arithmetic and allocation. |
| Async control | es-toolkit and Lodash | Both expose `once` and trailing `debounce` controls. |
| Async retry | es-toolkit and [p-retry](https://github.com/sindresorhus/p-retry) 8.0.0 | Both retry promise-returning operations and support a zero-delay retry configuration. |

Library versions are exact development dependencies in `tooling/package.json` and locked by
`bun.lock`.

## Reproduce the snapshot

Run three full passes without changing the working tree. The order rotates independently within
every three-library scenario even though different modules use different competitors.

```bash
mkdir -p .benchmarks/string-number-release/modules

bun run benchmark:modules -- --json \
  --library-order=Kern,es-toolkit,Lodash,date-fns,Day.js,Dinero.js,currency.js,p-retry \
  > .benchmarks/string-number-release/modules/run-1.json

bun run benchmark:modules -- --json \
  --library-order=es-toolkit,Lodash,date-fns,Day.js,Dinero.js,currency.js,p-retry,Kern \
  > .benchmarks/string-number-release/modules/run-2.json

bun run benchmark:modules -- --json \
  --library-order=Lodash,Day.js,currency.js,p-retry,Kern,es-toolkit,date-fns,Dinero.js \
  > .benchmarks/string-number-release/modules/run-3.json

bun run benchmark:report -- \
  .benchmarks/string-number-release/modules/run-1.json \
  .benchmarks/string-number-release/modules/run-2.json \
  .benchmarks/string-number-release/modules/run-3.json
```

The report rejects quick-mode artifacts, changed result IDs, incompatible source fingerprints, and
invalid per-scenario rotations. Each adapter verifies an untimed result before warmup. The full run
then records 21 samples of approximately 20 ms after approximately 20 ms of warmup. Scalar number
and money inputs rotate through bounded 32-value pools to resist constant folding without allocating
inside the timed operation.

## Recorded results

These are medians of three run medians recorded on 2026-08-16 with Bun 1.3.14, Linux x64, and an AMD
Ryzen 5 5600X. “Throughput” is the inverse of latency: competitor latency divided by Kern latency.
When Kern is slower, the last column reports Kern's latency multiple instead.

### Array

| Workload | Kern | es-toolkit | Lodash | Kern result versus fastest competitor |
| --- | ---: | ---: | ---: | ---: |
| `unique`, 10,000 values | 285.29 µs | 264.51 µs | 191.91 µs | 1.49× latency |
| `uniqueBy`, 10,000 objects | 213.26 µs | 243.07 µs | 412.77 µs | 12.3% lower latency · 1.14× throughput |
| `partition`, 10,000 values | 27.68 µs | 33.16 µs | 44.23 µs | 16.5% lower latency · 1.20× throughput |

The inputs contain 50% distinct values. Selector and predicate functions are shared and created
outside the timed path.

### Object

| Workload | Kern | es-toolkit | Lodash | Kern result versus fastest competitor |
| --- | ---: | ---: | ---: | ---: |
| Pick 100 from 1,000 keys | 3.81 µs | 2.64 µs | 11.32 µs | 1.44× latency |
| Omit 100 from 1,000 keys | 80.86 µs | 54.47 µs | 135.27 µs | 1.48× latency |

These rows use ordinary enumerable data properties so all outputs contain the same keys and values.
They do not represent full contract equivalence: Kern preserves own property descriptors and
null-prototype sources, which adds work that the faster value-copy path does not perform. Accessors,
symbols, hostile prototypes, and `deepFreeze` are correctness guards, not competitor rows.

### String

| Workload | Kern | es-toolkit | Lodash | Kern result versus fastest competitor |
| --- | ---: | ---: | ---: | ---: |
| `camelCase`, realistic ASCII phrase | 7.86 µs | 8.63 µs | 7.88 µs | tie |
| `kebabCase`, realistic ASCII phrase | 4.55 µs | 4.27 µs | 5.85 µs | 1.07× latency · near-tie |
| Truncate 371 to 32 characters | 213.4 ns | 257.4 ns | 204.4 ns | 1.04× latency · near-tie |

The truncation row intentionally uses printable ASCII and passes the same `...` omission, producing
identical text. Kern proves this subset with a cheap scan and slices directly; Unicode and control
text still use grapheme segmentation. Kern has 17.1% lower latency and 1.21× throughput than
es-toolkit on this row, while the 4.4% difference from Lodash is treated as a near-tie. The
comparison does not claim competitors preserve complex graphemes.

### Number

| Workload | Kern | es-toolkit | Lodash | Kern result versus fastest competitor |
| --- | ---: | ---: | ---: | ---: |
| Clamp to ordered bounds | 6.7 ns | 6.7 ns | 9.6 ns | tie |
| Round to two decimal places | 10.6 ns | 9.7 ns | 418.1 ns | 1.09× latency · near-tie |
| Test a half-open range | 6.5 ns | 6.4 ns | 6.3 ns | tie |

All three adapters receive the same rotating finite-number pool and produce equal results for every
fixture. Kern's common two-decimal path falls back before ambiguous ties and is additionally checked
against decimal exponent shifting over 10,000 deterministic values. es-toolkit always applies
binary scaling. Their 9.3% difference is inside the declared near-tie band. The tiny clamp and range
differences are also ties.

### Date

| Workload | Kern | date-fns | Day.js | Kern result versus fastest competitor |
| --- | ---: | ---: | ---: | ---: |
| Add 10 local-calendar days | 60.1 ns | 56.5 ns | 602.3 ns | 1.06× latency · near-tie |
| Add one clamped calendar month | 65.0 ns | 122.3 ns | 2.62 µs | 46.9% lower latency · 1.88× throughput |
| Start of host-local day | 53.1 ns | 52.2 ns | 470.6 ns | tie |
| Difference in local calendar days | 227.4 ns | 900.2 ns | 1.08 µs | 74.7% lower latency · 3.96× throughput |

All inputs are valid native `Date` objects created outside timing. Day.js returns its normal wrapper;
Kern and date-fns return native `Date` objects. Verification compares the resulting epoch value or
calendar-day count. Formatting is excluded because Kern's `Intl` contract is not equivalent to
token-based formatting.

### Money

| Workload | Kern | Dinero.js | currency.js | Kern result versus fastest competitor |
| --- | ---: | ---: | ---: | ---: |
| Add two minor-unit amounts | 8.1 ns | 289.0 ns | 265.4 ns | 96.9% lower latency · 32.77× throughput |
| Subtract two minor-unit amounts | 8.3 ns | 273.1 ns | 235.5 ns | 96.5% lower latency · 28.37× throughput |
| Multiply by 1.15 and round to cents | 60.2 ns | 426.1 ns | 243.9 ns | 75.3% lower latency · 4.05× throughput |
| Allocate equally to eight recipients | 1.09 µs | 2.18 µs | 2.54 µs | 50.0% lower latency · 2.00× throughput |

Amounts use each library's native public representation. Kern receives safe-integer minor units;
Dinero.js and currency.js receive preconstructed immutable money objects. Normal result construction
remains timed. Multiplication uses half-away-from-zero cent rounding in every adapter. Allocation
gives every adapter the same 10,003-unit total and eight equal weights, then verifies eight returned
shares. Currency formatting and parsing remain in the separate
Kern-only `Intl` matrix because the competitor APIs do not share the same locale and ISO-currency
contract.

### Async

| Workload | Kern | es-toolkit | Other competitor | Kern result versus fastest competitor |
| --- | ---: | ---: | ---: | ---: |
| Cached `once` result | 5.1 ns | 3.6 ns | Lodash: 4.0 ns | 1.42× latency |
| Schedule and cancel trailing debounce | 510.4 ns | 518.9 ns | Lodash: 596.0 ns | tie |
| Retry, first-attempt success | 127.9 ns | 135.5 ns | p-retry: 194.6 ns | 5.6% lower latency · 1.06× throughput |
| Retry, third-attempt success, zero delay | 842.6 ns | 2.18 ms | p-retry: 2.04 µs | 58.7% lower latency · 2.42× throughput |

Retry cases use the harness's awaited path, so promise settlement finishes inside the measured
operation. They use a preconstructed error, the same number of total attempts, and no intentional
backoff. Timer-duration benchmarks such as `sleep(10)` are omitted because scheduler precision would
dominate helper overhead.

## Snapshot provenance

| Run | Relative order | UTC timestamp | CPU frequency snapshot | Raw JSON SHA-256 |
| --- | --- | --- | ---: | --- |
| 1 | Kern first in every scenario | 2026-08-16 20:51:03 | 3,712 MHz | `46c5c1d365a33833f74984652a76baae750c3abb2a31558125bbf4f0e75dce4a` |
| 2 | Kern last in every scenario | 2026-08-16 20:51:38 | 3,711 MHz | `6bc03a7099cb1e477cf4aacb15d476d15b66ebbcfd5f0b8c31bf792c9665a610` |
| 3 | Kern in the middle of every scenario | 2026-08-16 20:52:16 | 3,712 MHz | `ce7c2487e3da61c4c3f76ee284bbfd17558cd0970c4c0bdaf9ace57c7128faff` |

All runs reported the `powersave` governor and shared these fingerprints:

| Input | SHA-256 or revision |
| --- | --- |
| Bun lockfile | `6f54539d94f80f932f93207d5565f31360520fed7b671caa34fb5bfd80dc7d11` |
| Benchmark sources and fixtures | `cbeacdd520b8d816ebe00e73f9deec1c04e2734a08d6d028b4ff77f615b25147` |
| Git HEAD | `1d096e5c22e93e91e8a38fa82074349480afe2f5` |
| Tracked binary diff | `e54d0b5571e992ceba23bcc97f05a79ca8997beedacb484b7aa68d8a2b068793` |
| Untracked-file manifest | `9533435ad1a2ed7dc70dbdd1615f9ae3b5cd12ca304252d1cedd2aef794c9e37` |

Raw artifacts stay in ignored `.benchmarks/string-number-release/modules/`. The
[benchmark adapters](https://github.com/sousaivan99/kern/blob/main/tooling/benchmarks/module-compare.bench.ts)
and [verification tests](https://github.com/sousaivan99/kern/blob/main/tooling/tests/module-benchmark.test.ts)
are tracked and inspectable.

## Interpretation limits

- These rows compare selected operations, not entire libraries.
- Absolute latency changes with runtime, CPU, power policy, JIT state, and operating-system load.
- A ratio near 1.00 is a tie, not evidence of a universal lead.
- Plain-data, ASCII, valid-date, finite-number, and USD fixtures deliberately avoid semantic
  mismatches. Stronger behavior outside those intersections remains covered by Kern's runtime tests.
- Public result construction is retained, but money libraries expose different abstraction levels.
- The non-gating score weights every scenario equally and must not support a “fastest library” claim.
