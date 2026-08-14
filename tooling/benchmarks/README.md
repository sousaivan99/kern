# Benchmarks

Kern's benchmark suite measures public behavior on the repository's supported Bun baseline. The
published Kern package remains dependency-free; Zod and Valibot are pinned development-only inputs
for the validation comparison. Kern-specific cases cover collections, exact money allocation,
finance rounding, Unicode grapheme truncation, validation composition, issue aggregation, wide
schemas, and wide inputs.

Run the complete suite:

```bash
bun run benchmark
```

Useful focused and machine-readable runs:

```bash
bun run benchmark:primitives
bun run benchmark:validation
bun run benchmark:validation:kern
bun run benchmark:quick
bun run benchmark -- --json > benchmark-results.json
```

The comparison suite covers equivalent valid objects, invalid objects, nested objects, 100-item
arrays, and early abort. Zod's early-abort row is reported as unsupported because it has no
equivalent parse-level option; the suite does not emulate one. Each timed case is warmed up before
adaptive calibration. The full report uses 21 timed samples and shows the median, p95, operations
per second, and normalized time per processed item. Quick mode uses five shorter samples and exists
to verify the suite during the repository release gate; do not use it for performance conclusions.

Interactive terminals receive an aligned, colored table. Set `NO_COLOR=1` to disable ANSI styling,
or `FORCE_COLOR=1` to retain colors when output is captured. JSON mode never emits styling or
human-readable logging.

Benchmark cases validate one untimed result before measurement. These checks catch stale or invalid
fixtures, but they do not replace runtime and type tests. Mutable `deepFreeze` inputs are prepared
before each timed batch so fixture construction is excluded from its measurements.

## Interpreting results

- Compare results from the same runtime version, hardware, power mode, and operating-system load.
- Prefer medians and repeated runs. Treat isolated differences below roughly 10% as noise until
  reproduced.
- Compare equivalent semantics. Do not remove validation issues, descriptor preservation, safety
  checks, or output construction to improve a number.
- The suite records data; it intentionally has no universal timing thresholds because shared and
  local machines vary substantially.
- Save JSON output when evaluating a performance-sensitive change so before/after data remains
  reviewable.

When a runtime implementation changes or a public helper is added, update the relevant benchmark
fixtures if the path is performance-sensitive or scales with input size. Always update correctness
tests separately.
