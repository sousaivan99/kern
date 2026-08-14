# Kern 1.0 public API inventory

This is the human-reviewed 1.0 API classification. It records the public package entrypoints,
runtime exports, and type exports; it is not an automated API snapshot.

## Keep

| Subpath | Runtime exports | Type exports |
| --- | --- | --- |
| `@sousaivan/kern/array` | `chunk`, `first`, `groupBy`, `last`, `partition`, `unique`, `uniqueBy`, `withoutFalsy` | `NonFalsy` |
| `@sousaivan/kern/async` | `debounce`, `once`, `retry`, `sleep`, `throttle` | `AbortOptions`, `RetryOptions`, `ScheduledFunction` |
| `@sousaivan/kern/date` | `addDays`, `addMonths`, `addYears`, `differenceInCalendarDays`, `endOfDay`, `formatDate`, `formatDateTime`, `formatRelativeTime`, `isAfter`, `isBefore`, `isSameDay`, `isSameInstant`, `isToday`, `isTomorrow`, `isValidDate`, `isYesterday`, `startOfDay`, `subtractDays`, `subtractMonths`, `subtractYears`, `toUTCISODate` | `DateFormatOptions`, `RelativeFormatOptions` |
| `@sousaivan/kern/money` | `addMoney`, `allocateMoney`, `applyDiscount`, `currencyMinorUnitDigits`, `formatMoney`, `multiplyMoney`, `parseMoney`, `percentageOf`, `roundMoney`, `subtractMoney`, `sumMoney` | `MoneyFormatOptions`, `MoneyParseOptions`, `MoneyRoundingMode`, `MoneyRoundingOptions` |
| `@sousaivan/kern/number` | `clamp`, `formatCompact`, `formatNumber`, `formatPercentage`, `isBetween`, `percentageOfTotal`, `round` | `BetweenOptions`, `NumberFormatOptions` |
| `@sousaivan/kern/object` | `deepFreeze`, `hasOwn`, `hasOwnPath`, `omit`, `pick` | `DeepReadonly`, `ObjectPath` |
| `@sousaivan/kern/string` | `camelCase`, `capitalize`, `isBlank`, `kebabCase`, `slugify`, `snakeCase`, `truncate`, `uncapitalize` | `StringCaseOptions` |
| `@sousaivan/kern/validation` | `ValidationError`, `array`, `boolean`, `date`, `enumeration`, `literal`, `number`, `object`, `record`, `string`, `tuple`, `union` | `AnySchema`, `Infer`, `InferInput`, `InferOutput`, `NumberSchema`, `ObjectInput`, `ObjectOutput`, `ObjectSchema`, `ParseOptions`, `PathSegment`, `RefinementOptions`, `SafeParseFailure`, `SafeParseResult`, `SafeParseSuccess`, `Schema`, `SchemaPresence`, `Shape`, `StandardSchemaV1`, `StringSchema`, `UnknownKeyPolicy`, `ValidationIssue`, `ValueKind` |
| `@sousaivan/kern` | Combined named re-exports of the module surfaces above; no unique root-only export | Combined type re-exports of the module surfaces above |
| `@sousaivan/kern/package.json` | Package metadata | — |

## Resolved before 1.0

| Export | Decision |
| --- | --- |
| `StandardSchemaV1` | Matches the official outer Standard Schema V1 interface containing `~standard`, including options, results, issues, paths, types, and inference helpers. |
| `Schema` | Extends the corrected Standard Schema interface while retaining Kern's fluent parsing and inference API. |

## Kept internal in 1.0

| Member | Decision |
| --- | --- |
| `Schema._run` | Package-private validation state exposed only through `InternalSchema`; consumers cannot access it. |
| `Schema._presence` | Package-private validation state exposed only through `InternalSchema`; consumers cannot access it. |

No top-level exported symbol is removed.
