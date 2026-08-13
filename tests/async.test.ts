import { afterEach, describe, expect, jest, test } from "bun:test"
import { debounce, once, retry, sleep, throttle } from "../src/async/index.js"

describe("async", () => {
  afterEach(() => jest.useRealTimers())

  test("sleeps and supports abortion", async () => {
    await expect(sleep(1)).resolves.toBeUndefined()
    const controller = new AbortController()
    const pending = sleep(1_000, { signal: controller.signal })
    controller.abort(new Error("cancelled"))
    await expect(pending).rejects.toThrow("cancelled")
  })

  test("retries and exposes attempt numbers", async () => {
    const attempts: number[] = []
    const result = await retry(
      (attempt) => {
        attempts.push(attempt)
        if (attempt < 3) throw new Error("temporary")
        return "ok"
      },
      { attempts: 3 },
    )
    expect(result).toBe("ok")
    expect(attempts).toEqual([1, 2, 3])
  })

  test("does not hide the last retry error", async () => {
    await expect(
      retry(
        () => {
          throw new Error("final")
        },
        { attempts: 2 },
      ),
    ).rejects.toThrow("final")
  })

  test("rejects invalid retry delays", async () => {
    await expect(
      retry(
        () => {
          throw new Error("retry")
        },
        { attempts: 2, delay: -1 },
      ),
    ).rejects.toThrow(RangeError)
  })

  test("runs a function exactly once and caches its outcome", () => {
    let calls = 0
    const value = once((input: number) => {
      calls += 1
      return input * 2
    })
    expect(value(2)).toBe(4)
    expect(value(9)).toBe(4)
    expect(calls).toBe(1)

    const expected = new Error("first")
    let failures = 0
    const failed = once(() => {
      failures += 1
      throw expected
    })
    expect(() => failed()).toThrow(expected)
    expect(() => failed()).toThrow(expected)
    expect(failures).toBe(1)
  })

  test("caches promise results and rejects recursive once invocation", () => {
    const expected = Promise.reject(new Error("async failure"))
    expected.catch(() => undefined)
    const cached = once(() => expected)
    expect(cached()).toBe(expected)
    expect(cached()).toBe(expected)

    let recursive: () => void
    recursive = once(() => recursive())
    expect(() => recursive()).toThrow("cannot be invoked recursively")
    expect(() => recursive()).toThrow("cannot be invoked recursively")
  })

  test("debounces calls, flushes, and clears the stale timer", () => {
    jest.useFakeTimers()
    const values: number[] = []
    const scheduled = debounce((value: number) => values.push(value), 100)
    scheduled(1)
    jest.advanceTimersByTime(25)
    expect(scheduled.flush()).toBe(1)
    scheduled(2)
    jest.advanceTimersByTime(75)
    expect(values).toEqual([1])
    jest.advanceTimersByTime(25)
    expect(values).toEqual([1, 2])
    scheduled.cancel()
  })

  test("throttles leading calls, flushes, and clears the stale timer", () => {
    jest.useFakeTimers({ now: 1_000 })
    const values: number[] = []
    const scheduled = throttle((value: number) => values.push(value), 100)
    scheduled(1)
    scheduled(2)
    expect(values).toEqual([1])
    jest.advanceTimersByTime(25)
    scheduled.flush()
    expect(values).toEqual([1, 2])
    scheduled(3)
    jest.advanceTimersByTime(75)
    expect(values).toEqual([1, 2])
    jest.advanceTimersByTime(25)
    expect(values).toEqual([1, 2, 3])
    scheduled.cancel()
  })

  test("cancels scheduled work on abort and ignores later calls", () => {
    jest.useFakeTimers()
    const controller = new AbortController()
    const values: number[] = []
    const scheduled = debounce((value: number) => values.push(value), 10, {
      signal: controller.signal,
    })
    scheduled(1)
    controller.abort()
    jest.advanceTimersByTime(20)
    scheduled(2)
    scheduled.flush()
    expect(values).toEqual([])
  })
})
