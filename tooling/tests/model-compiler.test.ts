import { describe, expect, test } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { gzipSync } from "node:zlib"
import { ValidationError } from "../../packages/kern/src/validation/index.js"
import { compileModels, serializeArtifact } from "../model-compiler/compiler.js"
import { generateModelArtifacts } from "../model-compiler/generate.js"
import {
  AdvancedUser,
  RuntimeOnlyUser,
  User,
  UserBatch,
  Wide10,
  Wide100,
  Wide1000,
} from "../model-compiler/generated/models.js"
import {
  AdvancedUser as AdvancedUserSource,
  RuntimeOnlyUser as RuntimeOnlyUserSource,
  UserBatch as UserBatchSource,
  User as UserSource,
  Wide10 as Wide10Source,
  Wide100 as Wide100Source,
  Wide1000 as Wide1000Source,
} from "../model-compiler/models.js"

const validUser = {
  age: 36,
  email: " ada@example.com ",
  ignored: "stripped",
  username: "  ada  ",
}

const validAdvancedUser = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  preferences: {},
  profile: {
    address: {
      city: " London ",
      countryCode: "GB",
      postalCode: "NW1",
      street: " 1 Analytical Engine Way ",
    },
    displayName: " Ada Lovelace ",
  },
  roles: ["admin", "author"],
  score: 99.5,
}

const batchUser = (index: number) => ({
  age: 18 + (index % 90),
  email: `person${index}@example.com`,
  username: `person${index}`,
})

const wideObject = (size: number): Record<string, unknown> => {
  const value: Record<string, unknown> = {}
  for (let index = 0; index < size; index += 1) value[`field${index}`] = index
  return value
}

describe("Kern model compiler experiment", () => {
  test("lets a beginner use one generated User value for parse and safeParse", () => {
    expect(User.compiled).toBe(true)
    expect(User.implementation).toBe("generated-fast-path-with-kern-fallback")
    expect(User.parse(validUser)).toEqual({
      age: 36,
      email: "ada@example.com",
      username: "ada",
    })
    expect(User.safeParse(validUser)).toEqual({
      success: true,
      data: { age: 36, email: "ada@example.com", username: "ada" },
    })
  })

  test("preserves current Kern results for valid and invalid beginner inputs", () => {
    const cases: readonly unknown[] = [
      validUser,
      { username: "ab", email: "wrong", age: 17 },
      { username: "ada", email: "ada@example.com" },
      { username: 42, email: null, age: "36" },
      null,
      [],
    ]
    for (const input of cases) {
      expect(User.safeParse(input)).toEqual(UserSource.safeParse(input))
    }
  })

  test("matches current Kern across 5,000 deterministic mixed User inputs", () => {
    let state = 0x6d_6f_64_65
    const random = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      return state / 0x1_0000_0000
    }
    const candidates: readonly unknown[] = [
      undefined,
      null,
      true,
      12,
      36,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
      "",
      "ada",
      "ada@example.com",
      {},
      [],
    ]
    for (let index = 0; index < 5_000; index += 1) {
      const pick = (): unknown => candidates[Math.floor(random() * candidates.length)]
      const input: Record<string, unknown> = {
        username: pick(),
        email: pick(),
        age: pick(),
      }
      if (random() < 0.15) delete input.username
      if (random() < 0.15) delete input.email
      if (random() < 0.15) delete input.age
      if (random() < 0.5) input.unknown = pick()
      expect(User.safeParse(input)).toEqual(UserSource.safeParse(input))
    }
  })

  test("preserves parse options and structured ValidationError failures", () => {
    const invalid = { username: "a", email: "wrong", age: 12 }
    expect(User.safeParse(invalid, { abortEarly: true })).toEqual(
      UserSource.safeParse(invalid, { abortEarly: true }),
    )
    expect(User.safeParse(invalid, { maxIssues: 2 })).toEqual(
      UserSource.safeParse(invalid, { maxIssues: 2 }),
    )
    expect(() => User.parse(invalid)).toThrow(ValidationError)
    expect(() => User.safeParse(validUser, { maxIssues: 0 })).toThrow(RangeError)
  })

  test("keeps Standard Schema V1 behavior", () => {
    expect(User["~standard"].validate(validUser)).toEqual(
      UserSource["~standard"].validate(validUser),
    )
    expect(User["~standard"].validate({ username: "a" })).toEqual(
      UserSource["~standard"].validate({ username: "a" }),
    )
  })

  test("falls back safely when getters throw", () => {
    const input = {
      get username(): string {
        throw new Error("secret callback detail")
      },
      email: "ada@example.com",
      age: 36,
    }
    expect(User.safeParse(input)).toEqual(UserSource.safeParse(input))
    expect(User.safeParse(input)).toMatchObject({
      success: false,
      issues: [{ code: "validation_exception", path: ["username"] }],
    })
  })

  test("validates an advanced nested model with arrays, optional values, and defaults", () => {
    expect(AdvancedUser.safeParse(validAdvancedUser)).toEqual(
      AdvancedUserSource.safeParse(validAdvancedUser),
    )
    expect(AdvancedUser.parse(validAdvancedUser)).toEqual({
      id: validAdvancedUser.id,
      preferences: { locale: "en", marketingEmails: false },
      profile: {
        address: {
          city: "London",
          countryCode: "GB",
          postalCode: "NW1",
          street: "1 Analytical Engine Way",
        },
        displayName: "Ada Lovelace",
      },
      roles: ["admin", "author"],
      score: 99.5,
    })
  })

  test("preserves deep issue paths for advanced failures", () => {
    const invalid = structuredClone(validAdvancedUser)
    invalid.profile.address.city = " "
    invalid.roles = [""]
    expect(AdvancedUser.safeParse(invalid)).toEqual(AdvancedUserSource.safeParse(invalid))
    expect(AdvancedUser.safeParse(invalid)).toMatchObject({
      success: false,
      issues: [
        { code: "too_small", path: ["profile", "address", "city"] },
        { code: "too_small", path: ["roles", 0] },
      ],
    })
  })

  test("keeps custom checks at runtime instead of pretending OpenAPI can execute them", () => {
    const input = { username: "admin", email: "admin@example.com" }
    expect(RuntimeOnlyUser.safeParse(input)).toEqual(RuntimeOnlyUserSource.safeParse(input))
    expect(RuntimeOnlyUser.safeParse(input)).toMatchObject({
      success: false,
      issues: [{ code: "custom", path: ["username"] }],
    })
  })

  test("validates large arrays without mutating caller-owned data", () => {
    const users = Array.from({ length: 1_000 }, (_, index) => batchUser(index))
    const input = { requestId: "123e4567-e89b-42d3-a456-426614174000", users }
    const snapshot = structuredClone(input)
    expect(UserBatch.safeParse(input)).toEqual(UserBatchSource.safeParse(input))
    expect(UserBatch.safeParse(input).success).toBe(true)
    expect(input).toEqual(snapshot)

    users[999] = { ...batchUser(999), email: "wrong" }
    expect(UserBatch.safeParse(input)).toEqual(UserBatchSource.safeParse(input))
    expect(UserBatch.safeParse(input)).toMatchObject({
      success: false,
      issues: [{ code: "invalid_email", path: ["users", 999, "email"] }],
    })
  })

  test("validates 10, 100, and 1,000-field objects with semantic parity", () => {
    const cases = [
      [10, Wide10, Wide10Source],
      [100, Wide100, Wide100Source],
      [1_000, Wide1000, Wide1000Source],
    ] as const
    for (const [size, compiled, source] of cases) {
      const valid = wideObject(size)
      valid.unknown = "stripped"
      expect(compiled.safeParse(valid)).toEqual(source.safeParse(valid))
      expect(compiled.safeParse(valid)).toMatchObject({ success: true })

      valid[`field${size - 1}`] = 0.5
      expect(compiled.safeParse(valid)).toEqual(source.safeParse(valid))
      expect(compiled.safeParse(valid)).toMatchObject({
        success: false,
        issues: [{ code: "not_integer", path: [`field${size - 1}`] }],
      })
    }
  })

  test("generates JSON Schema, OpenAPI components, forms, examples, and clear notices", () => {
    const artifacts = generateModelArtifacts()
    expect(artifacts.jsonSchema).toMatchObject({
      $defs: {
        User: {
          additionalProperties: false,
          properties: {
            age: { minimum: 18, maximum: 130, type: "integer" },
            email: { format: "email", type: "string" },
            username: { minLength: 3, maxLength: 32, type: "string" },
          },
          required: ["username", "email", "age"],
          type: "object",
        },
      },
    })
    expect(artifacts.openapi).toMatchObject({
      openapi: "3.1.0",
      components: { schemas: { User: { type: "object" } } },
    })
    expect(artifacts.forms).toMatchObject({
      User: {
        fields: {
          age: { control: "number", minimum: 18, step: 1 },
          email: { control: "email", label: "Email address" },
          username: { control: "text", label: "Username", minLength: 3 },
        },
      },
    })
    expect(artifacts.examples).toMatchObject({
      User: { age: 18, email: "ada@example.com", username: "ada" },
    })
    const runtimeOnlyReport = artifacts.report.find(
      (entry) => entry.modelName === "RuntimeOnlyUser",
    )
    expect(runtimeOnlyReport?.mode).toBe("runtime-fallback")
    expect(
      runtimeOnlyReport?.notices.some((notice) => notice.includes("custom application check")),
    ).toBe(true)
  })

  test("is deterministic and rejects confusing export names", () => {
    const first = generateModelArtifacts()
    const second = generateModelArtifacts()
    expect(second).toEqual(first)
    expect(() =>
      compileModels(
        { WrongName: UserSource },
        { runtimeImport: "../runtime.js", sourceImport: "../models.js" },
      ),
    ).toThrow('must use the same name in model("WrongName", ...)')
  })

  test("keeps checked-in generated files fresh", async () => {
    const artifacts = generateModelArtifacts()
    const outputDirectory = join(import.meta.dir, "../model-compiler/generated")
    const expected = {
      ...artifacts.modelSources,
      ...artifacts.validatorDeclarations,
      ...artifacts.validatorSources,
      "examples.json": serializeArtifact(artifacts.examples),
      "forms.json": serializeArtifact(artifacts.forms),
      "models.schema.json": serializeArtifact(artifacts.jsonSchema),
      "models.ts": artifacts.registrySource,
      "openapi.json": serializeArtifact(artifacts.openapi),
      "report.json": serializeArtifact(artifacts.report),
    }
    expect((await readdir(outputDirectory)).sort()).toEqual(Object.keys(expected).sort())
    for (const [file, contents] of Object.entries(expected)) {
      expect(await readFile(join(outputDirectory, file), "utf8")).toBe(contents)
    }
  })

  test("keeps a compiled User isolated from 100- and 1,000-field stress models", async () => {
    const fixture = join(import.meta.dir, "../model-compiler/size-fixtures/compiled-user.ts")
    const result = await Bun.build({
      entrypoints: [fixture],
      format: "esm",
      minify: true,
      target: "browser",
    })
    expect(result.success).toBe(true)
    const output = result.outputs.find((candidate) => candidate.path.endsWith(".js"))
    expect(output).toBeDefined()
    if (!output) return
    const bytes = new Uint8Array(await output.arrayBuffer())
    const source = new TextDecoder().decode(bytes)
    expect(source).not.toContain("field999")
    expect(gzipSync(bytes, { level: 9 }).byteLength).toBeLessThan(7_000)
  })
})
