# Contributing to Lithekit

Lithekit welcomes focused fixes, tests, documentation, performance work, and small public helpers that
fit its native-first scope. Runtime code must remain dependency-free, side-effect free, ESM-first,
and independently tree-shakeable.

## Development flow

1. Branch from `develop` and open normal pull requests back into `develop`.
2. Add public-behavior tests before or with an implementation. Include type tests when inference
   changes and documentation when consumers can observe the change.
3. Run focused checks while iterating, then run the authoritative `bun run check` before review.
4. Record consumer-visible runtime or type changes in the owning package's `CHANGELOG.md` and select
   the SemVer impact in the pull-request template.

```bash
bun install
bun run test
bun run typecheck
bun run check
```

Public runtime changes also need `bun run build`, `bun run size`, and `bun run benchmark:quick`.
Performance-sensitive changes need comparable full benchmarks before and after.

## Scope rules

- Prefer a native API unless a small semantic helper prevents a common error or removes meaningful
  boilerplate.
- Do not add runtime dependencies or mutate caller-owned data without an explicit mutating API.
- Keep public APIs narrow and avoid speculative modules or generic utility dumping grounds.
- Preserve each package's 1.x compatibility and follow its `SEMVER.md`.
- Report security concerns through [`SECURITY.md`](./SECURITY.md), not a public issue.

Release pull requests flow only from `develop` to `prod`; the package manifest defines independent
release groups, publish order, and package-specific tags.
