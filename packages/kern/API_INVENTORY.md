# Kern 1.0 public API inventory

This is the human-reviewed 1.0 API classification. It records the public package entrypoints,
runtime exports, and type exports; it is not an automated API snapshot.

## Keep

| Subpath | Runtime exports | Type exports |
| --- | --- | --- |
| `@kern/core/array` | `chunk`, `first`, `groupBy`, `last`, `partition`, `unique`, `uniqueBy`, `withoutFalsy` | `NonFalsy` |
| `@kern/core/async` | `debounce`, `once`, `retry`, `sleep`, `throttle` | `AbortOptions`, `RetryOptions`, `ScheduledFunction` |
| `@kern/core/date` | `addDays`, `addMonths`, `addYears`, `differenceInCalendarDays`, `endOfDay`, `formatDate`, `formatDateTime`, `formatRelativeTime`, `isAfter`, `isBefore`, `isSameDay`, `isSameInstant`, `isToday`, `isTomorrow`, `isValidDate`, `isYesterday`, `startOfDay`, `subtractDays`, `subtractMonths`, `subtractYears`, `toUTCISODate` | `DateFormatOptions`, `RelativeFormatOptions` |
| `@kern/core/money` | `addMoney`, `allocateMoney`, `applyDiscount`, `currencyMinorUnitDigits`, `formatMoney`, `multiplyMoney`, `parseMoney`, `percentageOf`, `roundMoney`, `subtractMoney`, `sumMoney` | `MoneyFormatOptions`, `MoneyParseOptions`, `MoneyRoundingMode`, `MoneyRoundingOptions` |
| `@kern/core/number` | `clamp`, `formatCompact`, `formatNumber`, `formatPercentage`, `isBetween`, `percentageOfTotal`, `round` | `BetweenOptions`, `NumberFormatOptions` |
| `@kern/core/object` | `deepFreeze`, `hasOwn`, `hasOwnPath`, `omit`, `pick` | `DeepReadonly`, `ObjectPath` |
| `@kern/core/string` | `camelCase`, `capitalize`, `isBlank`, `kebabCase`, `slugify`, `snakeCase`, `truncate`, `uncapitalize` | `StringCaseOptions` |
| `@kern/core/validation` | `ValidationError`, `array`, `boolean`, `date`, `enumeration`, `literal`, `number`, `object`, `record`, `string`, `tuple`, `union` | `AnySchema`, `Infer`, `InferInput`, `InferOutput`, `NumberSchema`, `ObjectInput`, `ObjectOutput`, `ObjectSchema`, `ParseOptions`, `PathSegment`, `RefinementOptions`, `SafeParseFailure`, `SafeParseResult`, `SafeParseSuccess`, `Schema`, `SchemaPresence`, `Shape`, `StandardSchemaV1`, `StringSchema`, `UnknownKeyPolicy`, `ValidationIssue`, `ValueKind` |
| `@kern/core` | Combined named re-exports of the module surfaces above; no unique root-only export | Combined type re-exports of the module surfaces above |
| `@kern/core/package.json` | Package metadata | — |

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
