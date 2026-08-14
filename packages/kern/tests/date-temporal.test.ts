import { describe, expect, test } from "bun:test"
import {
  addWithTemporal,
  endOfDayWithTemporal,
  startOfDayWithTemporal,
} from "../src/date/temporal.js"

const withTemporal = (descriptor: PropertyDescriptor, callback: () => void): void => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Temporal")
  Object.defineProperty(globalThis, "Temporal", { configurable: true, ...descriptor })
  try {
    callback()
  } finally {
    if (original) Object.defineProperty(globalThis, "Temporal", original)
    else Reflect.deleteProperty(globalThis, "Temporal")
  }
}

const zonedDateTime = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => {
  const zoned: Record<string, unknown> = {
    epochMilliseconds: 0,
    add: () => zoned,
    startOfDay: () => zoned,
    subtract: () => zoned,
    ...overrides,
  }
  return zoned
}

const temporalNamespace = (
  zoned: unknown,
  timeZone: unknown = "UTC",
): Readonly<Record<string, unknown>> => ({
  Instant: {
    fromEpochMilliseconds() {
      return { toZonedDateTimeISO: () => zoned }
    },
  },
  Now: { timeZoneId: () => timeZone },
})

describe("Temporal feature detection", () => {
  const date = new Date(0)

  test("rejects incomplete and hostile namespace shapes", () => {
    const cases: readonly unknown[] = [
      null,
      {},
      { Instant: null, Now: {} },
      { Instant: {}, Now: { timeZoneId() {} } },
      {
        Instant: new Proxy(
          {},
          {
            get() {
              throw new Error("hostile Instant")
            },
          },
        ),
        Now: { timeZoneId() {} },
      },
    ]

    for (const value of cases) {
      withTemporal({ value, writable: true }, () => {
        expect(addWithTemporal(date, { days: 1 })).toBeUndefined()
      })
    }

    withTemporal(
      {
        get() {
          throw new Error("hostile global")
        },
      },
      () => expect(addWithTemporal(date, { days: 1 })).toBeUndefined(),
    )
  })

  test("falls back when timezone and ZonedDateTime capabilities are unusable", () => {
    for (const value of [
      temporalNamespace(zonedDateTime(), ""),
      temporalNamespace(zonedDateTime(), 1),
      temporalNamespace(null),
      temporalNamespace({}),
      temporalNamespace(zonedDateTime({ subtract: undefined })),
      temporalNamespace(zonedDateTime({ epochMilliseconds: Number.POSITIVE_INFINITY })),
      temporalNamespace(zonedDateTime({ epochMilliseconds: 9e15 })),
    ]) {
      withTemporal({ value, writable: true }, () => {
        expect(addWithTemporal(date, { days: 1 })).toBeUndefined()
      })
    }

    const throwingConversion = {
      Instant: {
        fromEpochMilliseconds() {
          throw new Error("conversion failed")
        },
      },
      Now: { timeZoneId: () => "UTC" },
    }
    withTemporal({ value: throwingConversion, writable: true }, () => {
      expect(addWithTemporal(date, { days: 1 })).toBeUndefined()
    })
  })

  test("contains errors thrown by each Temporal operation", () => {
    const throwingAdd = zonedDateTime({
      add() {
        throw new Error("add failed")
      },
    })
    withTemporal({ value: temporalNamespace(throwingAdd), writable: true }, () => {
      expect(addWithTemporal(date, { days: 1 })).toBeUndefined()
      expect(endOfDayWithTemporal(date)).toBeUndefined()
    })

    const throwingStart = zonedDateTime({
      startOfDay() {
        throw new Error("start failed")
      },
    })
    withTemporal({ value: temporalNamespace(throwingStart), writable: true }, () => {
      expect(startOfDayWithTemporal(date)).toBeUndefined()
    })
  })
})
