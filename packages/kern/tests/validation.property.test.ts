import { expect, test } from "bun:test"
import { type AnySchema, number, object, string } from "../src/validation/index.js"
import { checkProperty } from "./support/property.js"

interface ValidationCase {
  readonly expectedPath?: readonly (string | number)[]
  readonly input: unknown
  readonly schema: AnySchema
  readonly secret?: string
}

const baseSchema = object({
  name: string(),
  count: number().integer(),
  nested: object({ label: string() }),
}).strict()

const validationCase = (index: number): ValidationCase => {
  switch (index % 12) {
    case 0:
      return { input: { name: "Ada", count: 1, nested: { label: "ok" } }, schema: baseSchema }
    case 1:
      return {
        expectedPath: ["nested", "label"],
        input: { name: "Ada", count: 1, nested: { label: 42 } },
        schema: baseSchema,
      }
    case 2: {
      const input = Object.create(null) as Record<string, unknown>
      Object.assign(input, { name: "Ada", count: 1, nested: { label: "ok" } })
      return { input, schema: baseSchema }
    }
    case 3: {
      const input = { name: "Ada", count: 1, nested: { label: "ok" } }
      Object.defineProperty(input, "__proto__", {
        enumerable: true,
        value: { polluted: true },
      })
      return { expectedPath: ["__proto__"], input, schema: baseSchema }
    }
    case 4: {
      const secret = "secret known getter"
      const input = { count: 1, nested: { label: "ok" } } as Record<string, unknown>
      Object.defineProperty(input, "name", {
        enumerable: true,
        get() {
          throw new Error(secret)
        },
      })
      return { expectedPath: ["name"], input, schema: baseSchema, secret }
    }
    case 5: {
      const secret = "secret prototype proxy"
      return {
        expectedPath: [],
        input: new Proxy(
          {},
          {
            getPrototypeOf() {
              throw new Error(secret)
            },
          },
        ),
        schema: baseSchema,
        secret,
      }
    }
    case 6: {
      const secret = "secret ownKeys proxy"
      return {
        expectedPath: [],
        input: new Proxy(
          { name: "Ada", count: 1, nested: { label: "ok" } },
          {
            ownKeys() {
              throw new Error(secret)
            },
          },
        ),
        schema: baseSchema,
        secret,
      }
    }
    case 7: {
      const input: Record<string, unknown> = {
        name: "Ada",
        count: 1,
        nested: { label: "ok" },
      }
      input.self = input
      return { expectedPath: ["self"], input, schema: baseSchema }
    }
    case 8: {
      const input = { name: "Ada", count: 1, nested: { label: "ok" } }
      Object.defineProperty(input, Symbol("metadata"), { enumerable: true, value: "ignored" })
      return { input, schema: baseSchema }
    }
    case 9: {
      const secret = "secret transform callback"
      return {
        expectedPath: [],
        input: "value",
        schema: string().transform(() => {
          throw new Error(secret)
        }),
        secret,
      }
    }
    case 10:
      return { expectedPath: [], input: ["not", "an", "object"], schema: baseSchema }
    default:
      return { expectedPath: [], input: Symbol("rejected value"), schema: baseSchema }
  }
}

test("property: hostile validation inputs stay bounded and sanitized", () => {
  checkProperty(
    "hostile validation inputs",
    (random, index) => ({ ...validationCase(index), maxIssues: random.integer(1, 4) }),
    ({ expectedPath, input, maxIssues, schema, secret }) => {
      const result = schema.safeParse(input, { maxIssues })
      expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
      if (result.success) return

      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues.length).toBeLessThanOrEqual(maxIssues)
      if (expectedPath) expect(result.issues[0]?.path).toEqual(expectedPath)
      for (const issue of result.issues) {
        expect(
          issue.path.every((segment) => typeof segment === "string" || typeof segment === "number"),
        ).toBe(true)
        expect(issue).not.toHaveProperty("value")
        expect(issue).not.toHaveProperty("input")
        expect(issue).not.toHaveProperty("cause")
        expect(issue).not.toHaveProperty("stack")
      }
      if (secret) expect(JSON.stringify(result)).not.toContain(secret)
    },
  )
})
