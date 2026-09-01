import { createForm } from "../../packages/form/src/index.js"
import {
  canonicalPath,
  createRoot,
  immutable,
  issuePath,
  parsePath,
  replacePath,
  setPath,
  structurallyEqual,
} from "../../packages/form/src/path.js"
import { type BenchmarkCase, invariant } from "./harness.js"

const sizes = [10, 100, 1_000] as const

const validationController = createForm({
  schema: {
    "~standard": {
      version: 1 as const,
      vendor: "form-benchmark",
      validate: async (value: unknown) => ({ value }),
    },
  },
})

export const formBenchmarks: BenchmarkCase[] = [
  ...sizes.flatMap((size): BenchmarkCase[] => {
    const names = Array.from({ length: size }, (_, index) => `users[${index}].email`)
    const paths = names.map(parsePath)
    const issues = paths.map((path) => ({ message: "Invalid", path }))
    const left = Array.from({ length: size }, (_, index) => ({ email: `user${index}@example.com` }))
    const right = left.map((item) => ({ ...item }))
    const draftRoot = createRoot(paths)
    for (const [index, path] of paths.entries())
      setPath(draftRoot, path, `user${index}@example.com`)
    const draft = immutable(draftRoot)

    return [
      {
        itemsPerOperation: size,
        name: "form field path parsing and canonicalization",
        run: () =>
          new Map(
            names.map((name) => {
              const path = parsePath(name)
              return [canonicalPath(path), path]
            }),
          ),
        size,
        suite: "form",
        unit: "controls",
        verify: (result) =>
          invariant(result instanceof Map && result.size === size, "all fields collected"),
      },
      {
        itemsPerOperation: size,
        name: "form nested draft construction",
        run: () => {
          const root = createRoot(paths)
          for (const [index, path] of paths.entries())
            setPath(root, path, `user${index}@example.com`)
          return root
        },
        size,
        suite: "form",
        unit: "controls",
        verify: (result) =>
          invariant(typeof result === "object" && result !== null, "draft constructed"),
      },
      {
        itemsPerOperation: size,
        name: "form issue path canonicalization",
        run: () =>
          issues.map((issue) => {
            const path = issuePath(issue.path)
            if (!path) throw new Error("Benchmark issue path was not mappable")
            return canonicalPath(path)
          }),
        size,
        suite: "form",
        unit: "issues",
        verify: (result) =>
          invariant(Array.isArray(result) && result.length === size, "issues indexed"),
      },
      {
        name: "form immutable field update",
        run: () => replacePath(draft, paths[Math.floor(size / 2)] ?? [], "changed@example.com"),
        size,
        suite: "form",
        unit: "draft fields",
        verify: (result) =>
          invariant(typeof result === "object" && result !== null, "draft updated"),
      },
      {
        itemsPerOperation: size,
        name: "form reset baseline comparison",
        run: () => structurallyEqual(left, right),
        size,
        suite: "form",
        unit: "controls",
        verify: (result) => invariant(result === true, "equivalent baseline"),
      },
      {
        itemsPerOperation: size,
        name: "form dirty comparison",
        run: () => {
          right[size - 1] = { email: "changed@example.com" }
          const result = structurallyEqual(left, right)
          const original = left.at(-1)
          if (!original) throw new Error("Benchmark fixture cannot be empty")
          right[size - 1] = { ...original }
          return result
        },
        size,
        suite: "form",
        unit: "controls",
        verify: (result) => invariant(result === false, "change detected"),
      },
    ]
  }),
  {
    async: true,
    name: "form validation scheduling",
    run: () => validationController.validate(),
    suite: "form",
    verify: (result) =>
      invariant(
        typeof result === "object" && result !== null && "status" in result,
        "validation completed",
      ),
  },
]
