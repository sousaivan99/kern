# Lithekit roadmap

Lithekit grows by solving common correctness problems with small, durable APIs. Items are directional,
not promises; size, native-platform progress, maintenance cost, and user evidence decide admission.

## Now

- Harden the 1.x release workflow, date overflow behavior, compatibility matrix, and package proof.
- Keep `bun run check` complete while reducing repeated builds and browser setup.
- Ship array schema bounds, `unknown()`, and `withoutNullish()` with full runtime/type coverage.

## Next

- Use benchmark evidence and concrete bug reports to improve existing modules.
- Improve diagnostics and documentation where consumers repeatedly need explanation.
- Evaluate only small additions that remove common boilerplate and fit an existing module.

## Later

- Revisit recursive schemas, discriminated unions, and additional money parsing only with clear user
  demand and acceptable size/correctness tradeoffs.
- Consider a new module only when its ownership is narrow and multiple durable helpers justify it.

Lithekit is not planning Lodash, Zod, or date-fns feature parity, an FX engine, or a timezone database.
