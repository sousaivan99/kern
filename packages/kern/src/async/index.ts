/** Options shared by operations that can observe cancellation. */
export interface AbortOptions {
  readonly signal?: AbortSignal
}

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError")

const assertDelay = (milliseconds: number): void => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new RangeError("Delay must be a non-negative finite number")
  }
}

/**
 * Resolves after a non-negative finite delay or rejects with an `AbortSignal` reason.
 * @throws {RangeError} When `milliseconds` is negative or non-finite.
 */
export const sleep = (milliseconds: number, options: AbortOptions = {}): Promise<void> => {
  assertDelay(milliseconds)
  const { signal } = options
  if (signal?.aborted) return Promise.reject(abortReason(signal))

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, milliseconds)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(
        signal ? abortReason(signal) : new DOMException("The operation was aborted", "AbortError"),
      )
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/** Retry configuration. `attempts` includes the initial call. */
export interface RetryOptions extends AbortOptions {
  readonly attempts?: number
  readonly delay?: number | ((attempt: number, error: unknown) => number)
  readonly shouldRetry?: (error: unknown, attempt: number) => boolean
}

/**
 * Retries an operation and rethrows its final error.
 * Attempts are numbered from one and delays support cancellation.
 */
export const retry = async <T>(
  operation: (attempt: number) => T | PromiseLike<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const attempts = options.attempts ?? 3
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new RangeError("Attempts must be a positive safe integer")
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (options.signal?.aborted) throw abortReason(options.signal)
    try {
      return await operation(attempt)
    } catch (error) {
      if (attempt === attempts || options.shouldRetry?.(error, attempt) === false) throw error
      const delay =
        typeof options.delay === "function" ? options.delay(attempt, error) : (options.delay ?? 0)
      assertDelay(delay)
      if (delay > 0) {
        await sleep(delay, options.signal ? { signal: options.signal } : {})
      }
    }
  }
  throw new Error("Retry exhausted unexpectedly")
}

/**
 * Invokes a callback exactly once and replays its first return value or thrown error.
 * Recursive invocation before the first call completes throws an `Error`.
 */
export const once = <Arguments extends unknown[], Result>(
  callback: (...arguments_: Arguments) => Result,
): ((...arguments_: Arguments) => Result) => {
  type State =
    | { readonly kind: "idle" }
    | { readonly kind: "running" }
    | { readonly kind: "returned"; readonly result: Result }
    | { readonly error: unknown; readonly kind: "threw" }
  let state: State = { kind: "idle" }
  return (...arguments_: Arguments): Result => {
    if (state.kind === "returned") return state.result
    if (state.kind === "threw") throw state.error
    if (state.kind === "running") throw new Error("A once callback cannot be invoked recursively")

    state = { kind: "running" }
    try {
      const result = callback(...arguments_)
      state = { kind: "returned", result }
      return result
    } catch (error) {
      state = { error, kind: "threw" }
      throw error
    }
  }
}

/** A void-returning scheduled wrapper with cancellation and synchronous flushing. */
export interface ScheduledFunction<Arguments extends unknown[], Result> {
  (...arguments_: Arguments): void
  cancel(): void
  flush(): Result | undefined
}

/**
 * Delays invocation until calls have stopped for `wait` milliseconds.
 * The wrapper ignores calls after its signal aborts.
 */
export const debounce = <Arguments extends unknown[], Result>(
  callback: (...arguments_: Arguments) => Result,
  wait: number,
  options: AbortOptions = {},
): ScheduledFunction<Arguments, Result> => {
  assertDelay(wait)
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Arguments | undefined
  let listening = false
  const detach = (): void => {
    if (!listening) return
    options.signal?.removeEventListener("abort", cancel)
    listening = false
  }
  const clearTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const invoke = (): Result | undefined => {
    clearTimer()
    detach()
    if (!pending) return undefined
    const arguments_ = pending
    pending = undefined
    return callback(...arguments_)
  }
  function cancel(): void {
    clearTimer()
    pending = undefined
    detach()
  }
  const scheduled = (...arguments_: Arguments): void => {
    if (options.signal?.aborted) return
    pending = arguments_
    clearTimer()
    if (options.signal && !listening) {
      options.signal.addEventListener("abort", cancel, { once: true })
      listening = true
    }
    timer = setTimeout(invoke, wait)
  }
  return Object.assign(scheduled, { cancel, flush: invoke })
}

/**
 * Invokes immediately, then retains at most one trailing call per `wait` interval.
 * The wrapper ignores calls after its signal aborts.
 */
export const throttle = <Arguments extends unknown[], Result>(
  callback: (...arguments_: Arguments) => Result,
  wait: number,
  options: AbortOptions = {},
): ScheduledFunction<Arguments, Result> => {
  assertDelay(wait)
  let lastInvocation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Arguments | undefined
  let listening = false
  const detach = (): void => {
    if (!listening) return
    options.signal?.removeEventListener("abort", cancel)
    listening = false
  }
  const clearTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const invoke = (): Result | undefined => {
    clearTimer()
    detach()
    if (!pending) return undefined
    const arguments_ = pending
    pending = undefined
    lastInvocation = Date.now()
    return callback(...arguments_)
  }
  function cancel(): void {
    clearTimer()
    pending = undefined
    lastInvocation = 0
    detach()
  }
  const scheduled = (...arguments_: Arguments): void => {
    if (options.signal?.aborted) return
    pending = arguments_
    if (options.signal && !listening) {
      options.signal.addEventListener("abort", cancel, { once: true })
      listening = true
    }
    const remaining = wait - (Date.now() - lastInvocation)
    if (lastInvocation === 0 || remaining <= 0) {
      invoke()
    } else if (timer === undefined) {
      timer = setTimeout(invoke, remaining)
    }
  }
  return Object.assign(scheduled, { cancel, flush: invoke })
}
