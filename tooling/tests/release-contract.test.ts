import { expect, test } from "bun:test"
import { compareVersions, validateReleaseContract } from "../scripts/shared/release.js"

const changelog = (version: string): string =>
  `## [${version}]\n\n[Unreleased]: https://example.test/compare/v${version}...HEAD\n[${version}]: https://example.test/release`

test("release contract compares stable semantic versions", () => {
  expect(compareVersions("1.0.2", "1.0.1")).toBe(1)
  expect(compareVersions("1.1.0", "1.0.9")).toBe(1)
  expect(compareVersions("1.0.1", "1.0.1")).toBe(0)
  expect(compareVersions("1.0.0", "2.0.0")).toBe(-1)
  expect(() => compareVersions("1.0.0-rc.1", "1.0.0")).toThrow("Invalid stable")
})

test("release contract allows unchanged package inputs", () => {
  expect(
    validateReleaseContract({
      changelog: "# Changelog",
      latestVersion: "1.0.1",
      packageChanged: false,
      version: "1.0.1",
    }),
  ).toEqual({ releaseRequired: false })
})

test("release contract requires a new version and complete changelog", () => {
  expect(
    validateReleaseContract({
      changelog: changelog("1.0.2"),
      latestVersion: "1.0.1",
      packageChanged: true,
      version: "1.0.2",
    }),
  ).toEqual({ releaseRequired: true })
  expect(() =>
    validateReleaseContract({
      changelog: changelog("1.0.1"),
      latestVersion: "1.0.1",
      packageChanged: true,
      version: "1.0.1",
    }),
  ).toThrow("must be newer")
  expect(() =>
    validateReleaseContract({
      changelog: "# Changelog",
      latestVersion: "1.0.1",
      packageChanged: true,
      version: "1.0.2",
    }),
  ).toThrow("release section")
})
