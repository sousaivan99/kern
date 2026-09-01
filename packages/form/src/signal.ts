import type { ReadonlyFormSignal } from "./types.js"

export interface FormSignal<T> extends ReadonlyFormSignal<T> {
  set(value: T): void
}

export const signal = <T>(initialValue: T): FormSignal<T> => {
  let current = initialValue
  const listeners = new Set<(value: T) => void>()
  return {
    get value() {
      return current
    },
    set(value) {
      if (Object.is(value, current)) return
      current = value
      for (const listener of listeners) listener(value)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
