---
title: Validation benchmarks
description: Run equivalent validation workloads against Kern, Zod, and Valibot with recorded methodology.
---

The validation comparison records absolute timings for Kern, Zod, and Valibot. It does not rank the
libraries or print “times faster” claims. Results are meaningful only when repeated on the same
runtime, hardware, power mode, and operating-system load.

## Run the comparison

```bash
bun install --frozen-lockfile
bun run benchmark:validation
```

Use JSON when keeping results for review:

```bash
bun run benchmark:validation -- --json > validation-results.json
```

`bun run benchmark:validation:kern` runs Kern's additional scaling and composition cases.
`bun run benchmark:quick` is a short fixture check used by the release gate; do not use quick mode
for performance conclusions.

## Scenarios

| Scenario | Operation | Fixture |
| --- | --- | --- |
| Parse valid object | Throwing `parse` success path | Three constrained fields |
| Reject invalid object | Non-throwing `safeParse` failure path | Three fields, three issues |
| Nested object | Throwing `parse` success path | Account containing a user profile |
| Array validation | Throwing `parse` success path | 100 valid user objects |
| Early abort | Non-throwing failure path | 100 invalid user objects, first issue only |

Schemas and inputs are created before timing. Each adapter verifies one untimed result before the
harness warms up, calibrates iterations, and records 21 samples. Reports include median and p95
latency, operations per second, normalized array time, case order, package versions, Bun version,
CPU, operating system, and the complete samples in JSON output.

## Limits of the comparison

- The public APIs and normal output construction of each library remain in the measured path.
- Invalid-object measurements use `safeParse` so JavaScript exception costs do not dominate the
  comparison.
- Kern and Valibot aggregate issues by default. The invalid fixture verifies three issues from each
  library.
- Zod has no equivalent parse-level `abortEarly` option, so its early-abort row is explicitly marked
  unsupported rather than simulated. See [Zod's parsing documentation](https://zod.dev/basics) and
  [Valibot's parsing configuration](https://valibot.dev/guides/parse-data/).
- Small differences can be noise. Prefer medians from multiple full runs and keep the JSON reports
  when making a performance claim.
