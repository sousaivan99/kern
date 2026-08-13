import type { ValidationIssue } from "./types"

export class ValidationError extends Error {
  readonly issues: readonly ValidationIssue[]

  constructor(issues: readonly ValidationIssue[]) {
    super(issues[0]?.message ?? "Validation failed")
    this.name = "ValidationError"
    this.issues = issues
  }
}
