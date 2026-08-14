# Kern

Kern is a zero-runtime-dependency, TypeScript-first collection of small, audited semantic
primitives for modern JavaScript runtimes. It focuses on work where a native one-liner is not
enough: structured validation, exact minor-unit money operations, calendar behavior, safe object
handling, and cancellation-aware async control flow.

The package name is `@sousaivan/kern`. Kern is ESM-only, side-effect free, framework agnostic, and split
into independently importable module entrypoints.

Kern 1.x is the stable public API line. Changes follow the [semantic versioning policy](./SEMVER.md),
and supported releases and runtimes follow the [support policy](./SUPPORT.md). See the
[changelog](./CHANGELOG.md) for release-by-release details.

## Requirements

| Environment | Supported baseline |
| --- | --- |
| TypeScript | 5.0+ |
| Node.js | 22+ |
| Bun | 1.3+ |
| Deno | Current stable |
| Browsers | Modern evergreen browsers with ES2022, `Intl`, and Web Abort APIs |

TypeScript consumers must use the modern `Bundler`, `Node16`, or `NodeNext` module-resolution
mode. Kern is ESM-only and does not support legacy `Node10` resolution or CommonJS `require()`.

Kern has no runtime dependencies. Native behavior and locale data can differ between runtime
versions, so supported environments are exercised by compatibility smoke tests.

## Install

```bash
bun add @sousaivan/kern
```

Prefer the smallest relevant subpath:

```ts
import { object, string } from "@sousaivan/kern/validation"
import { formatMoney } from "@sousaivan/kern/money"
import { addDays } from "@sousaivan/kern/date"
```

The root entrypoint is available for convenience, but subpaths make module boundaries explicit.

## Documentation path

If you are new to Kern, use this order:

1. **Installation** explains ESM, TypeScript module resolution, supported runtimes, and imports.
2. **Quick start** builds one validated order flow step by step.
3. **Framework tutorials** provide tested JavaScript, TypeScript, Vue, Nuxt, and React examples.
4. **Core ideas** explains unknown input, immutability, explicit units/defaults, and failure rules.
5. **Module guides** document every helper, option, default, return value, error, and edge case.
6. **API reference** provides generated signatures and source links for exact lookup.

The full guide source lives in
[`apps/docs/src/content/docs`](https://github.com/sousaivan99/kern/tree/main/apps/docs/src/content/docs).

## Principles

- Zero runtime dependencies and native APIs first, with small semantic wrappers for clarity.
- Small, opinionated contracts instead of Lodash, Zod, or date-fns parity.
- Strict TypeScript inference and structured failures.
- No import-time side effects or caller-owned data mutation.
- Independently tree-shakeable module entrypoints with enforced size budgets.
- Correctness and security boundaries take precedence over benchmarks.
- A helper must remove meaningful boilerplate, improve narrowing, or prevent a common correctness error.

Kern does not wrap native APIs merely to grow its surface. It does provide a few tiny helpers when
a semantic name makes application code easier to scan. Their documentation shows the native
equivalent so developers can understand both forms:

| Kern helper | Native equivalent |
| --- | --- |
| `first(values)` | `values[0]` |
| `last(values)` | `values.at(-1)` |
| `unique(values)` | `[...new Set(values)]` |
| `withoutFalsy(values)` | `values.filter(Boolean)` |
| `groupBy(values, selector)` | `Object.groupBy(values, selector)` |
| `isBefore(left, right)` | `left.getTime() < right.getTime()` |
| `isAfter(left, right)` | `left.getTime() > right.getTime()` |
| `formatNumber(value, { locale })` | `new Intl.NumberFormat(locale).format(value)` |
| `hasOwn(value, key)` | `Object.hasOwn(value, key)` after an object check |

`first()` and `last()` return `undefined` for empty arrays. `groupBy()` returns a null-prototype
object, so property keys such as `__proto__` are safe. `hasOwn()` accepts untrusted values and
returns `false` for primitives and `null` rather than throwing.

## Validation

```ts
import { number, object, string } from "@sousaivan/kern/validation"

const UserSchema = object({
  name: string().trim().min(2),
  email: string().email(),
  age: number().integer().min(18).optional(),
  role: string().default("member"),
})

const result = UserSchema.safeParse(input)
if (result.success) {
  const user = result.data
  console.log(user)
} else {
  console.error(result.issues)
}
```

`safeParse()` returns a discriminated result and does not throw for ordinary validation failure.
`parse()` returns inferred output or throws `ValidationError` containing the same structured
issues. Callback or hostile-object exceptions become generic validation issues rather than
escaping `safeParse()`.

`safeParse(value, { abortEarly, maxIssues })` aggregates by default and shares limits across nested
schemas. Invalid limits throw `RangeError`. Issues may add safe `expected`, `received`, and
primitive-only `details` metadata, but never retain rejected values or callback exceptions.

Object fields are required unless explicitly marked `.optional()` or `.default()`. Missing
required fields use the `required` issue code. Defaulted fields are required in inferred output,
optional fields are omitted when their output is `undefined`, and required schemas may
intentionally preserve an own property whose value is `undefined`. Unknown object keys are
stripped. Object schemas compose immutably with `pick`, `omit`, `partial`, and `extend`. Use
`strip()` (the default), `strict()`, or `passthrough()` for explicit unknown-key behavior.

Available schemas are `string`, `number`, `boolean`, `date`, `literal`, `array`, `object`, `tuple`,
`record`, `union`, and `enumeration`. All schemas support `optional`, `nullable`, `default`,
`transform`, and `refine`. Boolean refinements preserve the source type; TypeScript type guards
may narrow it.

Transforms preserve inferred input while changing output. `InferOutput<S>` and `InferInput<S>`
extract both sides; `Infer<S>` remains the convenient output alias for reusable named types. Every
schema also implements synchronous Standard Schema V1 through `~standard` with vendor `kern`.

String lengths use UTF-16 code units. `email()` is a small structural check, not address
verification. `url()` accepts any syntax supported by `new URL`, including `javascript:`, `data:`,
and `file:` URLs; it is not a safe-link validator or sanitizer. Caller-provided regular
expressions are cloned before use.

## Money

Money values are safe integers in currency **minor units**:

```ts
import { allocateMoney, applyDiscount, formatMoney, parseMoney, roundMoney, sumMoney } from "@sousaivan/kern/money"

formatMoney(1099, "EUR", { locale: "en-US" }) // €10.99
parseMoney("10,99 €", "EUR", { locale: "de-DE" }) // 1099
applyDiscount(1099, 15) // 934; 15 means 15%
sumMoney([1099, 250, -100]) // 1249
roundMoney(103, { roundingIncrement: 5 }) // 105
allocateMoney(100, [1, 1, 1]) // [34, 33, 33]
```

Formatting never converts minor units through a floating-point major-unit value and remains exact
through `Number.MAX_SAFE_INTEGER`. Currency fraction metadata and output come from native
`Intl.NumberFormat`.

`parseMoney()` is intentionally strict. It requires the selected locale's currency marker and
sign/currency placement, accepts localized digits, and rejects malformed grouping. Grouping may be
omitted, but when present it must follow the locale's primary and secondary group sizes. Extra
fraction digits use exact configurable rounding. It is not a free-form price or natural-language parser.

Arithmetic checks input, intermediate totals, and result safety. `sumMoney([])` returns zero.
Rounding supports all nine ECMA-402 modes plus positive safe-integer minor-unit increments; the
default is `halfExpand` (ties away from zero). Allocation uses exact proportions and stable largest
remainders. Discounts are limited to 0..100 percentage points.

Kern does not attach currency or scale to plain numeric amounts. It is not an FX engine, provider
currency table, accounting ledger, payment adapter, or compliance system. Consuming integrations
own currency identity, provider-specific scale rules, audit trails, and regulatory behavior.

## Number

Percentage helpers use percentage points consistently and compose directly:

```ts
import { formatPercentage, isBetween, percentageOfTotal } from "@sousaivan/kern/number"

const completion = percentageOfTotal(42, 50) // 84
formatPercentage(completion, { locale: "en-US" }) // 84%
isBetween(18, 13, 19, { inclusive: false }) // true
```

`isBetween()` includes its boundaries by default. Pass the named `inclusive` option when strict
comparison is required.

## Date

```ts
import {
  addDays,
  differenceInCalendarDays,
  formatDate,
  isSameDay,
  isSameInstant,
  isValidDate,
  subtractDays,
  toUTCISODate,
} from "@sousaivan/kern/date"

const tomorrow = addDays(new Date(), 1)
const yesterday = subtractDays(new Date(), 1)
formatDate(tomorrow, { locale: "en-GB", timeZone: "Europe/London" })
differenceInCalendarDays(tomorrow, yesterday)
isSameInstant(tomorrow, new Date(tomorrow.getTime()))
isSameDay(tomorrow, yesterday)
isValidDate(tomorrow)
toUTCISODate(tomorrow) // UTC YYYY-MM-DD
```

Date helpers validate and copy supplied `Date` objects. Add/subtract arithmetic, day boundaries,
and calendar-day comparisons use the host's local timezone. Instant comparison uses epoch
milliseconds. `toUTCISODate()` explicitly uses UTC.
`formatRelativeTime()` compares instants; its month/year unit selection uses average Gregorian
durations and is approximate. Kern does not attempt general timezone arithmetic.

[Temporal is Stage 4](https://github.com/tc39/proposal-temporal) and has shipped in Firefox,
Chrome, and Node 26. Kern still supports Node 22/24 and runtimes where Temporal is absent, so its
public API remains native `Date`. Calendar arithmetic and day boundaries use a complete global
Temporal implementation when one is available and otherwise use the equivalent `Date` path. Kern
does not bundle a polyfill or expose a competing Temporal abstraction.

## Object safety

`pick()` and `omit()` accept plain or null-prototype objects, retain own property descriptors, and
reject arrays and class instances. `hasOwn()` safely checks one own property. `hasOwnPath()` reads
own properties only and rejects
`__proto__`, `prototype`, and `constructor` path segments. Use an explicit segment array for keys
that contain dots.

`deepFreeze()` supports primitive values, arrays, plain objects, and null-prototype objects. It
validates the entire graph before freezing, supports cycles, and rejects accessors, functions,
class instances, `Map`, `Set`, `Date`, typed arrays, promises, and other mutable built-ins. It is an
immutability helper for plain data, not a security sandbox.

## Public modules

| Module | Public API |
| --- | --- |
| `validation` | `string`, `number`, `boolean`, `date`, `literal`, `array`, `object`, `tuple`, `record`, `union`, `enumeration`, `ValidationError`, validation types |
| `money` | `formatMoney`, `parseMoney`, `currencyMinorUnitDigits`, `addMoney`, `subtractMoney`, `sumMoney`, `multiplyMoney`, `percentageOf`, `applyDiscount`, `roundMoney`, `allocateMoney` |
| `date` | `formatDate`, `formatDateTime`, `formatRelativeTime`, `addDays`, `addMonths`, `addYears`, `subtractDays`, `subtractMonths`, `subtractYears`, `startOfDay`, `endOfDay`, `isValidDate`, `isBefore`, `isAfter`, `isSameInstant`, `isSameDay`, `isToday`, `isTomorrow`, `isYesterday`, `differenceInCalendarDays`, `toUTCISODate` |
| `number` | `clamp`, `round`, `isBetween`, `percentageOfTotal`, `formatNumber`, `formatCompact`, `formatPercentage` |
| `string` | `capitalize`, `uncapitalize`, `camelCase`, `kebabCase`, `snakeCase`, `truncate`, `slugify`, `isBlank` |
| `array` | `first`, `last`, `unique`, `uniqueBy`, `groupBy`, `partition`, `chunk`, `withoutFalsy` |
| `object` | `pick`, `omit`, `hasOwn`, `hasOwnPath`, `deepFreeze` |
| `async` | `sleep`, `retry`, `once`, `debounce`, `throttle` |

`once()` caches its first return value or thrown error and never invokes the callback again.
`debounce()` and `throttle()` expose `cancel()` and `flush()` and support `AbortSignal`.
`withoutFalsy()` uses JavaScript truthiness, including removal of `false`, numeric zero, empty
strings, `null`, `undefined`, and `NaN`.

Case conversion is deterministic by default and becomes locale-sensitive only when a locale is
explicitly requested. Word splitting is Unicode-aware but is not linguistic segmentation.
`truncate()` uses `Intl.Segmenter` grapheme clusters and does not split joined emoji or combining
sequences. Validation string lengths remain UTF-16 code units.

## Development and verification

```bash
bun install
bun run lint
bun run typecheck
bun run typecheck:minimum
bun run test
bun run test:coverage
bun run build
bun run size
bun run benchmark
bun run docs:check
bun run check
```

`bun install` also downloads the Chromium build used by the browser smoke test. This is a
development-only tool and is not included when consumers install Kern.

`bun run check` is the local release gate: it includes both the minimum and current TypeScript
compilers, dependency auditing, browser and current-runtime smoke tests, packed-package checks, and
the timezone suite. CI additionally runs the built package on Node 22/24/26, the minimum Bun 1.3
release, latest stable Bun, and current Deno. Runtime source changes must stay within the existing
gzip budgets: validation below 5 KB, finance-capable money below 2.5 KB, and date/string below 2 KB.

Build, test, timezone, and release-check commands use live progress indicators and collapse
successful subprocess output so the console remains active without becoming noisy. A failure always
prints the original captured command output. Use `bun test` directly when debugging with Bun's full
per-test reporter; `bun run test:watch` remains fully interactive. The progress UI comes from the
development-only `@clack/prompts` package and is not included in Kern's published runtime package.

The package is ESM-only. Tests use `bun:test`, and compile-time assertions live under `tests/types`.
The benchmark tooling uses pinned development-only Zod and Valibot packages for an equivalent
validation comparison; they are not dependencies of the published package. Kern-specific cases
cover scalable array, object, string, money, wide-input, wide-schema, record, and error-aggregation
paths. Reports include library versions, median and p95 latency, throughput, normalized time per
processed item, runtime and CPU metadata, and optional JSON output.

```bash
bun run benchmark:primitives
bun run benchmark:validation
bun run benchmark:validation:kern
bun run benchmark:quick
bun run benchmark -- --json > benchmark-results.json
```

Quick mode verifies benchmark fixtures as part of `bun run check`; use the full suite for
performance conclusions. See the [benchmark methodology](https://github.com/sousaivan99/kern/blob/main/tooling/benchmarks/README.md) for methodology and
comparison guidance.

## Build and releases

`bun run build` creates browser-targeted ESM bundles, source maps, and TypeScript declarations for
the root and every public subpath. `bun run pack:dry` reports the exact npm artifact without
publishing it.

Before opening a release pull request:

```bash
bun run check
bun run pack:dry
```

Pull requests into `main` or `prod` run the full CI matrix. Merging a release pull request into the
protected `prod` branch runs CI again on the merge commit; only a successful `prod` CI run can
trigger the provenance-enabled npm release workflow. Maintainers should follow
[RELEASING.md](./RELEASING.md), including the one-time npm scope/trusted-publisher setup.

## Security

See the repository [security policy](https://github.com/sousaivan99/kern/blob/main/SECURITY.md) for
the private reporting channel. Validation is not sanitization, syntactically valid URLs are not
necessarily safe destinations, and freezing plain data does not isolate untrusted code.

## License

MIT
