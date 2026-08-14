## What does this change?

<!-- Explain the outcome in plain language. A reviewer should understand what changes for users. -->

## Why is it needed?

<!-- Link the issue and explain the problem being solved. Use “Fixes #123” when appropriate. -->

## How was it verified?

<!-- List the exact commands and any manual/browser checks you ran. Include relevant results. -->

```text
bun run typecheck
bun run test
```

## Public API and compatibility

<!--
Delete choices that do not apply and explain any “Yes”.

- Public runtime API changed: No / Yes
- Exported TypeScript contract changed: No / Yes
- Documented behavior or error changed: No / Yes
- Runtime or TypeScript support changed: No / Yes
- SemVer impact: None / Patch / Minor / Major
-->

## Contributor checklist

- [ ] The change is focused and contains no unrelated refactor.
- [ ] Tests cover new behavior and regressions, including error paths where relevant.
- [ ] Type-level tests cover changed inference or declarations where relevant.
- [ ] Documentation and runnable examples are updated for user-visible behavior.
- [ ] New or changed exports are intentional, documented, and tree-shakeable.
- [ ] Runtime code adds no dependency and has no import-time side effects.
- [ ] Caller-owned data is not mutated unless the API explicitly documents mutation.
- [ ] `bun run size` was checked for runtime changes.
- [ ] Relevant benchmarks were run for performance-sensitive or input-scaling changes.
- [ ] `CHANGELOG.md` was updated when users need to know about the change.
- [ ] `bun run check` passes, or any unrelated failure is explained above.

## Reviewer notes

<!-- Call out risky code, unresolved tradeoffs, screenshots, migration concerns, or follow-up work. -->
