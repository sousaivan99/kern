import type { ValidationIssue } from "./types.js"

/** Error thrown by `Schema.parse`, containing the same issues as `safeParse`. */
export class ValidationError extends Error {
  /** Structured issues produced by the failed parse. */
  readonly errors: readonly ValidationIssue[]

  constructor(errors: readonly ValidationIssue[]) {
    super(errors[0]?.message ?? "Validation failed")
    this.name = "ValidationError"
    this.errors = errors
  }
}
