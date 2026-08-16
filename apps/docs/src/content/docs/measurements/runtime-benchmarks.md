---
title: Runtime benchmarks
description: Reproduce Kern-only array, string, money, object, and Intl scaling measurements.
---

This suite measures Kern's non-validation modules across small and scaling workloads. It records
absolute latency rather than assigning an overall score. It also does not compare unrelated helper
libraries: matching a function name is not evidence that two helpers preserve the same semantics.

See [validation benchmarks](./validation-benchmarks/) for the public-API comparison with Zod and
Valibot, and [module comparisons](./module-benchmarks/) for array, object, string, number, date,
money, and async competitors. For the implementation behind these results, read [performance
internals](../../advanced/performance-internals/).

## Run the suite

Capture three full runs without changing the working tree between them:

```bash
mkdir -p .benchmarks/runtime

bun run benchmark:primitives -- --json > .benchmarks/runtime/run-1.json
bun run benchmark:primitives -- --json > .benchmarks/runtime/run-2.json
bun run benchmark:primitives -- --json > .benchmarks/runtime/run-3.json

bun run benchmark:report -- \
  .benchmarks/runtime/run-1.json \
  .benchmarks/runtime/run-2.json \
  .benchmarks/runtime/run-3.json
```

The report command calculates the median of the three run medians. Add `--json` for exact numbers,
run medians, input SHA-256 hashes, and environment metadata. The fixtures and result verification
are inspectable in the
[primitive benchmark source](https://github.com/sousaivan99/kern/blob/main/tooling/benchmarks/primitives.bench.ts).

## Recorded snapshot

These representative rows were recorded on Bun 1.3.14, Linux x64, and an AMD Ryzen 5 5600X on
2026-08-16. Each run used 21 timed samples per case with approximately 20 ms per sample and 20 ms
of warmup. Lower latency is better.

| Module and operation | Stable scenario ID | Work per operation | Median of run medians |
| --- | --- | ---: | ---: |
| Array `chunk` | `primitives:array-chunk-size-100:10000` | 10,000 items, chunks of 100 | 7.80 µs |
| Array `partition` | `primitives:array-partition-even-odd:10000` | 10,000 numeric items | 28.83 µs |
| Money `allocateMoney` | `primitives:money-allocatemoney:10000` | 10,000 exact-share recipients | 57.99 µs |
| String `camelCase` | `primitives:string-camelcase:10000` | 10,000 UTF-16 code units | 258.77 µs |
| Number formatting | `primitives:intl-numberformat-repeated-configuration` | One warm repeated configuration | 956.5 ns |
| Date formatting | `primitives:intl-datetimeformat-repeated-explicit-zone` | One warm explicit-zone configuration | 1.35 µs |
| Money formatting | `primitives:intl-money-format-repeated-configuration` | One warm repeated configuration | 1.04 µs |
| Money parsing | `primitives:intl-money-parse-repeated-configuration` | One warm repeated configuration | 1.57 µs |

The `Intl` rows are deliberately labeled warm: an untimed verification call populates an eligible
cache entry before sampling. They do not represent import plus first-call latency. Run the isolated
cold suite separately:

```bash
bun run benchmark:intl:cold -- --json
bun run benchmark:intl:memory -- --json
```

In the recorded isolated-process cold run, import plus first call had medians of 10.70 ms for number
formatting, 11.81 ms for explicit-zone date formatting, 11.35 ms for money formatting, and 13.23 ms
for money parsing. Its raw JSON SHA-256 is
`46387f2050d6dbb4a73889c533d853a0b8e3e7e4873292fa063e5e48eb8876cb`.

## Snapshot provenance

| Run | UTC timestamp | CPU frequency snapshot | Raw JSON SHA-256 |
| --- | --- | ---: | --- |
| 1 | 2026-08-16 16:12:57 | 3,710 MHz | `ed261bf2cd88fe7b71a09a37e85f49fe2d2591e975c3b5a16d6c72361082df64` |
| 2 | 2026-08-16 16:13:35 | 3,846 MHz | `6a32a2017c11f6af94bd845a3bea1ec77c776c5e227b7a4b2c9e4f126b6f2b7d` |
| 3 | 2026-08-16 16:14:14 | 1,738 MHz | `2eb0b77ceef706ea19b0718b5cd242e0e84ace03fecaf3d3712c1a830e79e217` |

All three runs reported the `powersave` governor and shared these source fingerprints:

| Input | SHA-256 or revision |
| --- | --- |
| Bun lockfile | `1bcb29e07d396f0af2dc602b03a4d4bc4dadd5c5c093d8f3f08e7da963be8861` |
| Benchmark sources and fixtures | `7a0a6efc4281ef826717add94d2b1cb74fb5b2162805081535a2f4c574914fd9` |
| Git HEAD | `1d096e5c22e93e91e8a38fa82074349480afe2f5` |
| Tracked binary diff | `6e86004fe26854980577987a59b85e8b6609d89754182c1613fc0f0135d74a40` |
| Untracked-file manifest | `d91414aec5cb96a9f34edd4ca42066b62908e881fa58cacfa0b7b13f16ca2d1e` |

## Interpretation limits

- Absolute timings vary with hardware, runtime, operating-system load, JIT state, and power policy.
- The table is a representative subset. The JSON report includes every array, object, string,
  money, number, date, freeze, and cache-boundary scenario.
- Warm, cold, cache-boundary, and 128-key churn cases answer different questions and must not be
  combined into one speed claim.
- Historical optimization percentages are intentionally omitted from this page unless both source
  states and their raw artifacts are archived. Current-source results are reproducible directly.
- Benchmarks verify fixtures, but runtime and type tests remain the correctness authority.
