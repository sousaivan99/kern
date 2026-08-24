# Contributing to Kern

Kern welcomes focused fixes, tests, documentation, performance work, and small public helpers that
fit its native-first scope. Runtime code must remain dependency-free, side-effect free, ESM-first,
and independently tree-shakeable.

## Development flow

1. Branch from `develop` and open normal pull requests back into `develop`.
2. Add public-behavior tests before or with an implementation. Include type tests when inference
   changes and documentation when consumers can observe the change.
3. Run focused checks while iterating, then run the authoritative `bun run check` before review.
4. Record consumer-visible runtime or type changes in `packages/kern/CHANGELOG.md` and select the
   SemVer impact in the pull-request template.

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
- Preserve Kern 1.x compatibility and follow [`packages/kern/SEMVER.md`](./packages/kern/SEMVER.md).
- Report security concerns through [`SECURITY.md`](./SECURITY.md), not a public issue.

Release pull requests flow only from `develop` to `prod`; maintainers follow
[`packages/kern/RELEASING.md`](./packages/kern/RELEASING.md).
