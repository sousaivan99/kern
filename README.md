# Kern

Kern is a zero-runtime-dependency, TypeScript-first collection of small, audited semantic
primitives for modern JavaScript runtimes. It focuses on work where a native one-liner is not
enough: structured validation, exact minor-unit money operations, calendar behavior, safe object
handling, and cancellation-aware async control flow.

The temporary package name is `@kern/core`. Kern is ESM-only, side-effect free, framework
agnostic, and split into independently importable module entrypoints.

## Requirements

| Environment | Supported baseline |
| --- | --- |
| TypeScript | 5.0+ |
| Node.js | 22+ |
| Bun | 1.3+ |
| Deno | Current stable |
| Browsers | Modern evergreen browsers with ES2022, `Intl`, and Web Abort APIs |

Kern has no runtime dependencies. Native behavior and locale data can differ between runtime
versions, so supported environments are exercised by compatibility smoke tests.

## Install

```bash
bun add @kern/core
```

Prefer the smallest relevant subpath:

```ts
import { object, string } from "@kern/core/validation"
import { formatMoney } from "@kern/core/money"
import { addDays } from "@kern/core/date"
```

The root entrypoint is available for convenience, but subpaths make module boundaries explicit.

## Principles

- Zero runtime dependencies and native APIs first.
- Small, opinionated contracts instead of Lodash, Zod, or date-fns parity.
- Strict TypeScript inference and structured failures.
- No import-time side effects or caller-owned data mutation.
- Independently tree-shakeable module entrypoints with enforced size budgets.
- Correctness and security boundaries take precedence over benchmarks.

Kern deliberately does not wrap adequate native expressions. Use `array[0]`, `array.at(-1)`,
`[...new Set(array)]`, `Object.groupBy`, direct date comparisons, and `Intl.NumberFormat` when those
already express the behavior you need.

## Validation

```ts
import { number, object, string, type Infer } from "@kern/core/validation"

const UserSchema = object({
  name: string().trim().min(2),
  email: string().email(),
  age: number().integer().min(18).optional(),
  role: string().default("member"),
})

type User = Infer<typeof UserSchema>

const result = UserSchema.safeParse(input)
if (result.success) {
  const user: User = result.data
  console.log(user)
} else {
  console.error(result.errors)
}
```

`safeParse()` returns a discriminated result and does not throw for ordinary validation failure.
`parse()` returns inferred output or throws `ValidationError` containing the same structured
issues. Callback or hostile-object exceptions become generic validation issues rather than
escaping `safeParse()`.

Object fields are required unless explicitly marked `.optional()` or `.default()`. Missing
required fields use the `required` issue code. Defaulted fields are required in inferred output,
optional fields are omitted when their output is `undefined`, and required schemas may
intentionally preserve an own property whose value is `undefined`. Unknown object keys are
stripped.

Available schemas are `string`, `number`, `boolean`, `date`, `literal`, `array`, `object`, `tuple`,
`record`, `union`, and `enumeration`. All schemas support `optional`, `nullable`, `default`,
`transform`, and `refine`. Boolean refinements preserve the source type; TypeScript type guards
may narrow it.

String lengths use UTF-16 code units. `email()` is a small structural check, not address
verification. `url()` accepts any syntax supported by `new URL`, including `javascript:`, `data:`,
and `file:` URLs; it is not a safe-link validator or sanitizer. Caller-provided regular
expressions are cloned before use.

## Money

Money values are safe integers in currency **minor units**:

```ts
import { applyDiscount, formatMoney, parseMoney } from "@kern/core/money"

formatMoney(1099, "EUR", { locale: "en-US" }) // €10.99
parseMoney("10,99 €", "EUR", { locale: "de-DE" }) // 1099
applyDiscount(1099, 15) // 934; 15 means 15%
```

Formatting never converts minor units through a floating-point major-unit value and remains exact
through `Number.MAX_SAFE_INTEGER`. Currency fraction metadata and output come from native
`Intl.NumberFormat`.

`parseMoney()` is intentionally strict. It requires the selected locale's currency marker and
sign/currency placement, accepts localized digits, and rejects malformed grouping. Grouping may be
omitted, but when present it must follow the locale's primary and secondary group sizes. Extra
fraction digits round half away from zero. It is not a free-form price or natural-language parser.

Arithmetic checks input and result safety. Kern does not attach a currency to plain numeric
amounts, so applications remain responsible for never combining different currencies.

## Date

```ts
import { addDays, differenceInCalendarDays, formatDate, toISODate } from "@kern/core/date"

const tomorrow = addDays(new Date(), 1)
formatDate(tomorrow, { locale: "en-GB", timeZone: "Europe/London" })
differenceInCalendarDays(tomorrow, new Date())
toISODate(tomorrow) // UTC YYYY-MM-DD
```

Date helpers validate and copy supplied `Date` objects. Calendar arithmetic, day boundaries, and
calendar-day comparisons use the host's local timezone. `toISODate()` explicitly uses UTC.
`formatRelativeTime()` compares instants; its month/year unit selection uses average Gregorian
durations and is approximate. Kern does not attempt general timezone arithmetic.

## Object safety

`pick()` and `omit()` accept plain or null-prototype objects, retain own property descriptors, and
reject arrays and class instances. `hasOwnPath()` reads own properties only and rejects
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
| `money` | `formatMoney`, `parseMoney`, `currencyMinorUnitDigits`, `addMoney`, `subtractMoney`, `multiplyMoney`, `percentageOf`, `applyDiscount` |
| `date` | `formatDate`, `formatDateTime`, `formatRelativeTime`, `addDays`, `addMonths`, `addYears`, `startOfDay`, `endOfDay`, `isToday`, `isTomorrow`, `isYesterday`, `differenceInCalendarDays`, `toISODate` |
| `number` | `clamp`, `round`, `isBetween`, `calculatePercentage`, `formatCompact`, `formatPercent` |
| `string` | `capitalize`, `uncapitalize`, `camelCase`, `kebabCase`, `snakeCase`, `truncate`, `slugify`, `isBlank` |
| `array` | `uniqueBy`, `chunk`, `compact` |
| `object` | `pick`, `omit`, `hasOwnPath`, `deepFreeze` |
| `async` | `sleep`, `retry`, `once`, `debounce`, `throttle` |

`once()` caches its first return value or thrown error and never invokes the callback again.
`debounce()` and `throttle()` expose `cancel()` and `flush()` and support `AbortSignal`. `compact()`
uses JavaScript truthiness, including removal of `false`, numeric zero, empty strings, `null`,
`undefined`, and `NaN`.

Case conversion uses Unicode-aware regular expressions and normalization but does not perform
locale-specific linguistic segmentation. `truncate()` counts Unicode code points, not grapheme
clusters.

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
bun run example
bun run check
```

`bun run check` is the local release gate: it includes both the minimum and current TypeScript
compilers, dependency auditing, browser and current-runtime smoke tests, packed-package checks, and
the timezone suite. CI additionally runs the package on Node 22/24 and current Deno. Runtime source
changes must stay within the existing gzip budgets; validation remains below 5 KB and money/date
below 2 KB.

The package is ESM-only. Tests use `bun:test`, compile-time assertions live under `tests/types`, and
the validation benchmark is deliberately dependency-free.

## Build and publish

`bun run build` creates browser-targeted ESM bundles, source maps, and TypeScript declarations for
the root and every public subpath. `bun run pack:dry` reports the exact npm artifact without
publishing it.

Before publishing:

```bash
bun run check
bun run pack:dry
npm publish --access public
```

Publishing is intentionally manual. Replace the temporary `@kern/core` name in package metadata,
documentation, and consumer fixtures before publishing under another name.

## Security

See [SECURITY.md](./SECURITY.md) for private vulnerability reporting. Validation is not
sanitization, syntactically valid URLs are not necessarily safe destinations, and freezing plain
data does not isolate untrusted code.

## License

MIT
