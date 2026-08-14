interface TemporalDuration {
  readonly days?: number
  readonly months?: number
  readonly years?: number
  readonly milliseconds?: number
}

interface TemporalArithmeticOptions {
  readonly overflow: "constrain"
}

interface TemporalZonedDateTime {
  readonly epochMilliseconds: number
  add(duration: TemporalDuration, options?: TemporalArithmeticOptions): TemporalZonedDateTime
  subtract(duration: TemporalDuration): TemporalZonedDateTime
  startOfDay(): TemporalZonedDateTime
}

interface TemporalInstant {
  toZonedDateTimeISO(timeZone: string): TemporalZonedDateTime
}

interface TemporalNamespace {
  readonly Instant: {
    fromEpochMilliseconds(epochMilliseconds: number): TemporalInstant
  }
  readonly Now: {
    timeZoneId(): string
  }
}

const isObject = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function"

const callable = (value: object, key: PropertyKey): boolean => {
  try {
    return typeof Reflect.get(value, key) === "function"
  } catch {
    return false
  }
}

let cachedTemporal: { readonly namespace: TemporalNamespace; readonly source: object } | undefined

const temporalNamespace = (): TemporalNamespace | undefined => {
  try {
    const candidate = (globalThis as { readonly Temporal?: unknown }).Temporal
    if (!isObject(candidate)) return undefined
    if (cachedTemporal?.source === candidate) return cachedTemporal.namespace
    const instant = Reflect.get(candidate, "Instant") as unknown
    const now = Reflect.get(candidate, "Now") as unknown
    if (!isObject(instant) || !isObject(now)) return undefined
    if (!callable(instant, "fromEpochMilliseconds") || !callable(now, "timeZoneId")) {
      return undefined
    }
    return candidate as unknown as TemporalNamespace
  } catch {
    return undefined
  }
}

const fromZonedDateTime = (value: TemporalZonedDateTime): Date | undefined => {
  const epochMilliseconds = value.epochMilliseconds
  if (!Number.isFinite(epochMilliseconds)) return undefined
  const output = new Date(epochMilliseconds)
  return Number.isNaN(output.getTime()) ? undefined : output
}

const zonedDateTime = (date: Date): TemporalZonedDateTime | undefined => {
  const temporal = temporalNamespace()
  if (!temporal) return undefined

  try {
    const timeZone = temporal.Now.timeZoneId()
    if (typeof timeZone !== "string" || timeZone.length === 0) return undefined
    const zoned = temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(
      timeZone,
    ) as unknown
    if (!isObject(zoned)) return undefined
    if (
      !callable(zoned, "add") ||
      !callable(zoned, "subtract") ||
      !callable(zoned, "startOfDay") ||
      typeof Reflect.get(zoned, "epochMilliseconds") !== "number"
    ) {
      return undefined
    }
    cachedTemporal = { namespace: temporal, source: temporal }
    return zoned as unknown as TemporalZonedDateTime
  } catch {
    return undefined
  }
}

export const addWithTemporal = (date: Date, duration: TemporalDuration): Date | undefined => {
  try {
    const zoned = zonedDateTime(date)
    return zoned ? fromZonedDateTime(zoned.add(duration, { overflow: "constrain" })) : undefined
  } catch {
    return undefined
  }
}

export const startOfDayWithTemporal = (date: Date): Date | undefined => {
  try {
    const zoned = zonedDateTime(date)
    return zoned ? fromZonedDateTime(zoned.startOfDay()) : undefined
  } catch {
    return undefined
  }
}

export const endOfDayWithTemporal = (date: Date): Date | undefined => {
  try {
    const zoned = zonedDateTime(date)
    if (!zoned) return undefined
    const end = zoned.startOfDay().add({ days: 1 }).subtract({ milliseconds: 1 })
    return fromZonedDateTime(end)
  } catch {
    return undefined
  }
}
