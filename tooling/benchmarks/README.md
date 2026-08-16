# Benchmarks

Kern's benchmark suite measures public behavior on the repository's supported Bun baseline. The
published Kern package remains dependency-free. Comparison libraries are pinned development-only
inputs under `tooling/`. Kern-specific cases cover collections, exact money allocation,
finance rounding, Unicode grapheme truncation, validation composition, issue aggregation, wide
schemas, and wide inputs.

Run the complete suite:

```bash
bun run benchmark
```

Useful focused and machine-readable runs:

```bash
bun run benchmark:primitives
bun run benchmark:intl:cold
bun run benchmark:intl:memory
bun run benchmark:modules
bun run benchmark:report -- run-1.json run-2.json run-3.json
bun run benchmark:validation
bun run benchmark:validation:kern
bun run benchmark:quick
bun run benchmark -- --json > benchmark-results.json
```

The comparison suite contains 29 scenarios (86 timed cases and one explicitly unsupported case).
It measures schema construction, constrained strings, parse and safe-parse object success, Standard
Schema success, rotating 32-schema shapes, one-issue and aggregated
object failures; depth-three and 25-field objects; unknown-key stripping; defaults and optional
properties; transform/refinement pipelines; valid arrays at 1, 10, 100, and 1,000 items; sparse array
failures at the same sizes; dense issue aggregation; and parse-level early abort. Zod's early-abort
row is reported as unsupported because it has no equivalent parse-level option; the suite does not
emulate one.

The module comparison adds 23 scenarios and 69 timed adapters across array, object, string, number,
date, money, async control, and async retry. Each scenario has exactly three adapters. Scalar number
and money inputs rotate through bounded 32-value pools to resist constant folding without allocating
inside the timed call. Use the exact three global orders documented on the
[module benchmark page](../../apps/docs/src/content/docs/measurements/module-benchmarks.md); the
reporter verifies the Latin-square order relative to each scenario's own competitors.

Each timed case is warmed up before adaptive calibration. The full report uses 21 timed samples and
shows the median, p95, operations per second, workload size, and normalized time only when the whole
workload is actually processed. In particular, early abort is not divided by the input array's
length. Quick mode uses five shorter samples and exists to verify the suite during the repository
release gate; do not use it for performance conclusions.

After the result table, a diagnostic comparison score summarizes the shared scenarios. Each scenario
is worth one point. A library gets the point for a clear win; when multiple medians are within 10% of the
fastest median, those libraries split the point and the result is counted as a near-tie. The score
also reports clear wins, near-ties, slower cases, and scenario coverage. A scenario is excluded from
every library's score unless all libraries support it, so Zod's unsupported early-abort case cannot
advantage Kern or Valibot. JSON output includes the score plus the exact clear-win and tied scenario
names.

The score gives every fixture equal weight. It is non-gating: it never affects exit status, patch
acceptance, phase acceptance, or performance claims. It is a compact description of this suite,
not an overall product grade. Quick mode labels its score as smoke-only because five short samples
are not stable enough for conclusions.

Interactive terminals receive an aligned, colored table. Set `NO_COLOR=1` to disable ANSI styling,
or `FORCE_COLOR=1` to retain colors when output is captured. JSON mode never emits styling or
human-readable logging.

Every case has a stable machine-readable ID. Benchmark cases validate one untimed result before
measurement. These checks catch stale or invalid fixtures, but they do not replace runtime and type
tests. Mutable `deepFreeze` inputs are prepared
before each timed batch so fixture construction is excluded from its measurements, with calibration
capped at 2,048 iterations. Cold `Intl` measurements run in isolated processes; the memory runner
forces garbage collection between 128-key churn rounds.

For competitive comparisons, keep three JSON runs and rotate library order with
`--library-order=Kern,Zod,Valibot`, `--library-order=Zod,Valibot,Kern`, and
`--library-order=Valibot,Kern,Zod`. Compare the median of the three run medians. JSON metadata records
the runtime, CPU and power metadata, case order, lockfile and benchmark hashes, Git state, binary diff
hash, and untracked-file manifest hash.

`bun run benchmark:report -- run-1.json run-2.json run-3.json` calculates that median of run medians
and emits a Markdown table. Add `--json` for a machine-readable summary containing the SHA-256 of
each input artifact. The command rejects quick-mode or mismatched artifacts instead of silently
combining different environments or source states. Use `--scenario=<stable ID>` to select rows.

## Interpreting results

- Compare results from the same runtime version, hardware, power mode, and operating-system load.
- Prefer medians and repeated runs. Treat isolated differences below roughly 10% as noise until
  reproduced.
- Compare equivalent semantics. Do not remove validation issues, descriptor preservation, safety
  checks, or output construction to improve a number.
- Read successful throughput, sparse failure, dense issue aggregation, and early abort as separate
  workloads. There is no meaningful aggregate winner across them.
- Treat the score as a navigation aid. Inspect the underlying scenario medians and p95 values before
  deciding which result matters to an application.
- The suite records data; it intentionally has no universal timing thresholds because shared and
  local machines vary substantially.
- Save JSON output when evaluating a performance-sensitive change so before/after data remains
  reviewable.

When a runtime implementation changes or a public helper is added, update the relevant benchmark
fixtures if the path is performance-sensitive or scales with input size. Always update correctness
tests separately.
