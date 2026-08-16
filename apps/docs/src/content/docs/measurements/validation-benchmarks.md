---
title: Validation benchmarks
description: Run equivalent validation workloads against Kern, Zod, and Valibot with recorded methodology.
---

The validation comparison records absolute timings for Kern, Zod, and Valibot. It does not assign
an overall library ranking or print “times faster” claims. Results are meaningful only when repeated
on the same runtime, hardware, power mode, and operating-system load.

Lower latency is better in every table on this page. Percentages describe lower latency, not the
ambiguous phrase “times faster.”

The [performance internals guide](../../advanced/performance-internals/) explains the interpreter,
failure sentinel, path stack, safe object writer, and compatibility tradeoffs behind the measured
result.

## Run the comparison

```bash
bun install --frozen-lockfile
bun run benchmark:validation
```

Use JSON when keeping results for review:

```bash
mkdir -p .benchmarks/validation

bun run benchmark:validation -- --json --library-order=Kern,Zod,Valibot \
  > .benchmarks/validation/run-1.json
bun run benchmark:validation -- --json --library-order=Zod,Valibot,Kern \
  > .benchmarks/validation/run-2.json
bun run benchmark:validation -- --json --library-order=Valibot,Kern,Zod \
  > .benchmarks/validation/run-3.json
```

Generate the same median-of-run-medians table used below:

```bash
bun run benchmark:report -- \
  .benchmarks/validation/run-1.json \
  .benchmarks/validation/run-2.json \
  .benchmarks/validation/run-3.json
```

Add `--json` to retain the summary and its input artifact hashes. The report command rejects quick
runs, mismatched result IDs, or artifacts with different runtime, CPU, lockfile, benchmark-source,
Git-diff, or untracked-file fingerprints. Use `--scenario=<stable ID>` one or more times to select
specific rows.

`bun run benchmark:validation:kern` runs Kern's additional scaling and composition cases.
`bun run benchmark:quick` is a short fixture check used by the release gate; do not use quick mode
for performance conclusions.

Capture the Kern-only scaling snapshot independently because it does not have a library order:

```bash
mkdir -p .benchmarks/reduction-release/validation-kern

bun run benchmark:validation:kern -- --json \
  > .benchmarks/reduction-release/validation-kern/run-1.json
bun run benchmark:validation:kern -- --json \
  > .benchmarks/reduction-release/validation-kern/run-2.json
bun run benchmark:validation:kern -- --json \
  > .benchmarks/reduction-release/validation-kern/run-3.json

bun run benchmark:report -- \
  .benchmarks/reduction-release/validation-kern/run-1.json \
  .benchmarks/reduction-release/validation-kern/run-2.json \
  .benchmarks/reduction-release/validation-kern/run-3.json
```

## Interpreter optimization result

This snapshot compares Kern 1.0.0, Zod 4.4.3, and Valibot 1.4.2 on the public APIs represented by
each stable scenario ID. It was recorded on 2026-08-16 using three rotated full runs and the median
of their three run medians.

| Successful headline | Stable scenario ID | Kern | Zod | Valibot | Kern advantage over fastest competitor |
| --- | --- | ---: | ---: | ---: | ---: |
| `parse()` three-field object | `validation-compare:object:parse-valid-3-field-object:3` | 45.3 ns | 196.7 ns | 117.3 ns | 61.4% lower latency · 2.59× throughput |
| `safeParse()` three-field object | `validation-compare:object:safeparse-valid-3-field-object:3` | 56.8 ns | 215.5 ns | 126.6 ns | 55.1% lower latency · 2.23× throughput |
| Standard Schema three-field object | `validation-compare:interoperability:standard-schema-valid-3-field-object` | 57.3 ns | 216.0 ns | 129.6 ns | 55.8% lower latency · 2.26× throughput |
| `parse()` depth-three object | `validation-compare:nested:parse-valid-depth-3-object:3` | 175.8 ns | 295.7 ns | 231.3 ns | 24.0% lower latency · 1.32× throughput |
| `parse()` 25-field object | `validation-compare:wide-object:parse-valid-25-field-object:25` | 0.624 µs | 1.51 µs | 1.61 µs | 58.7% lower latency · 2.42× throughput |
| `parse()` 1,000-user array | `validation-compare:array-success:parse-1000-item-valid-array:1000` | 119.75 µs | 342.81 µs | 438.44 µs | 65.1% lower latency · 2.86× throughput |

The phase gate required Kern latency to be at most 90% of the lowest competitor latency. All five
headline API workloads passed; Standard Schema was a no-regression guard and is shown because it is
a public interoperability path.

Throughput multiples are the inverse of latency: fastest competitor latency divided by Kern
latency. They describe operations per unit time for the same workload, not a separate benchmark.

Failure behavior is measured separately because successful parsing and issue construction do
different work:

| Failure workload | Kern | Zod | Valibot | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Aggregate 300 issues from 100 invalid users | 31.33 µs | 446.76 µs | 115.19 µs | Kern had 72.8% lower latency and 3.68× throughput versus Valibot. |
| Stop after the first issue in 1,000 invalid users | 159.9 ns | Unsupported | 436.5 ns | Kern had 63.4% lower latency and 2.73× throughput versus Valibot. |

Zod is marked unsupported for early abort because it has no equivalent parse-level option. It is
not assigned a synthetic implementation or excluded only from Kern's timing.

## Record scaling snapshot

`record()` now builds successful output in a null-prototype object, writes own data properties
without consulting inherited setters, and restores `Object.prototype` once after validation. The
same path safely preserves an own `__proto__` key. These Kern-only results include field validation
and public `safeParse()` result construction:

| Stable scenario ID | Entries | Median latency | Normalized latency |
| --- | ---: | ---: | ---: |
| `validation-kern:record-success:1000` | 1,000 | 82.99 µs | 83.0 ns/entry |
| `validation-kern:record-success:10000` | 10,000 | 1.16 ms | 116 ns/entry |
| `validation-kern:record-success:100000` | 100,000 | 16.92 ms | 169 ns/entry |

This is a scaling measurement, not a cross-library ranking. The input is a plain object containing
numeric values, the value schema is `number().integer()`, and every output is verified before
warmup. Larger normalized values reflect object size, allocation, and garbage-collection pressure.

The three full runs were recorded on the same Bun 1.3.14/Linux x64/AMD Ryzen 5 5600X machine as the
refreshed module snapshot:

| Run | UTC timestamp | CPU frequency snapshot | Raw JSON SHA-256 |
| --- | --- | ---: | --- |
| 1 | 2026-08-16 20:22:15 | 3,712 MHz | `830df4fc6d236db4936b968d89870e4a46621dbd03679371e5dc30af40234ad3` |
| 2 | 2026-08-16 20:22:27 | 3,704 MHz | `6e7dd24fffac319059e66390358d88a2c90906520c724936034bfe7a8fdabb55` |
| 3 | 2026-08-16 20:22:39 | 3,667 MHz | `72c2c2b5b41917d03c19ae6bc86c459157822d59735bb60d45669cadd857a1dc` |

All three reported the `powersave` governor and the following shared fingerprints:

| Input | SHA-256 or revision |
| --- | --- |
| Bun lockfile | `6f54539d94f80f932f93207d5565f31360520fed7b671caa34fb5bfd80dc7d11` |
| Benchmark sources and fixtures | `cbeacdd520b8d816ebe00e73f9deec1c04e2734a08d6d028b4ff77f615b25147` |
| Git HEAD | `1d096e5c22e93e91e8a38fa82074349480afe2f5` |
| Tracked binary diff | `a62dc3147e53a94485f04f28ffee7939846ddffaba3ae5dea56c7c33e63f0cf3` |
| Untracked-file manifest | `57af9a115b8b4fd45edaff07ad80bf740e01ca061a45e255761eb9d3b26156b6` |

A separate single Node 24.16 guard run recorded Kern at 102.6 ns for three-field `parse()`, 116.2 ns
for three-field `safeParse()`, 665.7 ns for depth-three parsing, 1.53 µs for 25 fields, and 425.2 µs
for the 1,000-user array. Its raw JSON SHA-256 is
`51fc71e8d21e1111e38ced38ede31c6509d11561bcf78ee33f3cd20417c7915f`. One fixed-order run is not
enough for a competitive ranking; Bun remains the competitive target for this snapshot.

## Snapshot provenance

The table above came from full JSON artifacts with 21 timed samples per case, approximately 20 ms
per sample, and approximately 20 ms of warmup. The machine reported Linux x64, an AMD Ryzen 5 5600X,
the `powersave` governor, and CPU snapshots of 3,699, 1,738, and 3,712 MHz. Reporting those changing
frequency snapshots is intentional: it is one reason the result is machine-local.

| Run | Library order | UTC timestamp | Raw JSON SHA-256 |
| --- | --- | --- | --- |
| 1 | Kern → Zod → Valibot | 2026-08-16 16:05:32 | `2b6465dcad9589741c8274cd4489eb381d4014552e0f36c4a6ed17db3c61add9` |
| 2 | Zod → Valibot → Kern | 2026-08-16 16:06:16 | `9e853fe752ac26a4e48f4937771723922c65a55c144162b4f7ae1141189a12ce` |
| 3 | Valibot → Kern → Zod | 2026-08-16 16:06:58 | `0eb7b2a7e164e5d7f6d0987b6e25061c71b9be5c857aeb669782fcc353b52e8e` |

The three artifacts share these fingerprints:

| Input | SHA-256 or revision |
| --- | --- |
| Bun lockfile | `1bcb29e07d396f0af2dc602b03a4d4bc4dadd5c5c093d8f3f08e7da963be8861` |
| Benchmark sources and fixtures | `7a0a6efc4281ef826717add94d2b1cb74fb5b2162805081535a2f4c574914fd9` |
| Git HEAD | `1d096e5c22e93e91e8a38fa82074349480afe2f5` |
| Tracked binary diff | `cfca02c2e53a3056c2e02e5ad0eca3a5bb3f510f097b19e9cf1c29067c13375a` |
| Untracked-file manifest | `d91414aec5cb96a9f34edd4ca42066b62908e881fa58cacfa0b7b13f16ca2d1e` |

Raw timestamped artifacts stay outside published source so generated timing data does not inflate
the package or documentation repository. Their hashes make review attachments verifiable. A new
checkout should be expected to produce different absolute timings; reproduce the ordering and
relative comparison rather than treating these nanoseconds as universal constants.

## Scenarios

The suite contains 29 scenarios: 86 timed cases and one unsupported Zod early-abort case. Every
supported row runs one untimed verification before measurement. The schemas, inputs, adapters, and
verification are inspectable in the
[validation comparison source](https://github.com/sousaivan99/kern/blob/main/tooling/benchmarks/validation-compare.bench.ts).

| Area | Operations | Workloads |
| --- | --- | --- |
| Construction and primitive overhead | Schema construction, throwing success, and non-throwing failure | Three-field schema; constrained string |
| Typical object | `parse`, successful `safeParse`, and failure | Three constrained fields; one and three issues |
| Interoperability and shapes | Standard Schema success and rotating parse | Three fields; 32 fixed schemas and input shapes |
| Nested object | Success and aggregated failure | Three object levels; three leaf issues |
| Wide object | Success and aggregated failure | 25 constrained fields; 25 issues |
| Object behavior | Parse and construct output | Strip 25 unknown keys; apply a default and omit an optional field |
| Pipeline | Success and non-throwing failure | Trim, minimum length, custom refinement, and transform |
| Valid arrays | Throwing success | 1, 10, 100, and 1,000 user objects |
| Sparse array failure | Non-throwing failure, invalid item last | 1, 10, 100, and 1,000 user objects; three issues |
| Dense issue aggregation | Non-throwing failure | 1, 10, and 100 invalid users; 3, 30, and 300 issues |
| Early abort | Non-throwing failure | 1,000 invalid users; stop after the first issue |

Schemas and inputs are created before timing. Each adapter verifies one untimed result before the
harness warms up, calibrates iterations, and records 21 samples. Reports include category, workload
size, median and p95 latency, operations per second, normalized time for workloads that process every
item, stable case ID, case order, package versions, runtime version, CPU and power metadata, lockfile
and fixture hashes, Git state, binary diff hash, untracked manifest hash, and the complete samples in
JSON output. Early-abort time is deliberately not divided by the 1,000-item input size because only
the first invalid item is processed.

## Comparison score

The console prints a non-gating diagnostic score after the detailed table. Each fully supported scenario contributes one
point:

- A clear fastest median receives one point.
- Medians within 10% of the fastest are treated as a near-tie and split the point equally.
- The summary also shows clear wins, near-ties, slower cases, and library coverage.
- A scenario is excluded for every library when any library cannot run it. Zod's unsupported
  early-abort case therefore gives no points to Kern or Valibot.

JSON output includes `comparisonScores`, including the exact `clearWinScenarios` and
`tiedFastestScenarios` behind each count. The score weights every scenario equally; it is a compact
index into the detailed results, not an overall library grade. It never affects exit status, patch
or phase acceptance, or performance claims. Scores from `--quick` are explicitly marked smoke-only
and should not be used for conclusions.

## Limits of the comparison

- The public APIs and normal output construction of each library remain in the measured path.
- Invalid-object measurements use `safeParse` so JavaScript exception costs do not dominate the
  comparison.
- Failure cases verify identical top-level issue counts for every library: one, three, 25, 30, or
  300 depending on the fixture.
- Zod has no equivalent parse-level `abortEarly` option, so its early-abort row is explicitly marked
  unsupported rather than simulated. See [Zod's parsing documentation](https://zod.dev/basics) and
  [Valibot's parsing configuration](https://valibot.dev/guides/parse-data/).
- Small differences can be noise. Prefer medians from multiple full runs and keep the JSON reports
  when making a performance claim.
- Rotate library execution order across three runs and compare the median of their medians. The
  accepted order is Kern/Zod/Valibot, Zod/Valibot/Kern, then Valibot/Kern/Zod.
- Successful parsing, sparse failures, dense issue construction, and early abort answer different
  questions. Use the score to locate patterns, then inspect the scenarios that match the application.
