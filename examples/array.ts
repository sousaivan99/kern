import { chunk, compact, uniqueBy } from "@kern/core/array"

export const runArrayExamples = (): void => {
  console.log("\nArray")

  const events = [
    { id: "evt-1", category: "billing" },
    { id: "evt-2", category: "security" },
    { id: "evt-1", category: "billing" },
  ]
  console.log("unique primitives (native)", [...new Set(["vue", "react", "vue", "svelte"])])
  console.log(
    "unique records",
    uniqueBy(events, (event) => event.id),
  )
  console.log("API batches", chunk([1, 2, 3, 4, 5], 2))
  console.log("first and last (native)", events[0], events.at(-1))
  console.log("truthy values", compact([0, 1, false, "ready", null, undefined]))
}

if (import.meta.main) runArrayExamples()
