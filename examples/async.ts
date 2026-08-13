import { debounce, once, retry, sleep, throttle } from "@kern/core/async"

export const runAsyncExamples = async (): Promise<void> => {
  console.log("\nAsync")

  await sleep(1000)
  console.log("sleep completed")

  const attempts: number[] = []
  const response = await retry(
    (attempt) => {
      attempts.push(attempt)
      if (attempt < 3) throw new Error("Temporary network error")
      return { ok: true }
    },
    { attempts: 4, delay: 5 },
  )
  console.log("retry", response, attempts)

  let generated = 0
  const getRequestId = once(() => `request-${++generated}`)
  console.log("once", getRequestId(), getRequestId())

  const debouncedValues: string[] = []
  const saveSearch = debounce((query: string) => debouncedValues.push(query), 100)
  saveSearch("ker")
  saveSearch("kern")
  saveSearch.flush()
  console.log("debounced latest value", debouncedValues)

  const throttledValues: number[] = []
  const trackScroll = throttle((position: number) => throttledValues.push(position), 1000)
  trackScroll(10)
  trackScroll(20)
  trackScroll.flush()
  console.log("throttled leading and trailing values", throttledValues)

  const controller = new AbortController()
  controller.abort(new DOMException("Example cancelled", "AbortError"))
  try {
    await sleep(100, { signal: controller.signal })
  } catch (error) {
    console.log("aborted sleep", error instanceof Error ? `${error.name}: ${error.message}` : error)
  }
}

if (import.meta.main) await runAsyncExamples()
