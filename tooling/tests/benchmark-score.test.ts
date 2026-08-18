import { describe, expect, test } from "bun:test"
import { scoreComparison } from "../benchmarks/score.js"

describe("benchmark comparison score", () => {
  test("splits points inside the noise band and counts clear wins", () => {
    const score = scoreComparison([
      { library: "Kern", medianNanoseconds: 100, scenario: "near tie" },
      { library: "Zod", medianNanoseconds: 110, scenario: "near tie" },
      { library: "Valibot", medianNanoseconds: 150, scenario: "near tie" },
      { library: "Kern", medianNanoseconds: 100, scenario: "clear winner" },
      { library: "Zod", medianNanoseconds: 130, scenario: "clear winner" },
      { library: "Valibot", medianNanoseconds: 90, scenario: "clear winner" },
      { library: "Kern", medianNanoseconds: 80, scenario: "unsupported case" },
      { library: "Zod", scenario: "unsupported case", unsupported: "not available" },
      { library: "Valibot", medianNanoseconds: 70, scenario: "unsupported case" },
    ])

    expect(score).toMatchObject({
      excludedScenarios: ["unsupported case"],
      scoredScenarios: 2,
      tieBandPercent: 10,
      totalScenarios: 3,
    })
    expect(score.rows).toEqual([
      {
        clearWinScenarios: [],
        clearWins: 0,
        coverage: 3,
        library: "Kern",
        score: 0.5,
        slower: 1,
        tiedFastest: 1,
        tiedFastestScenarios: ["near tie"],
      },
      {
        clearWinScenarios: [],
        clearWins: 0,
        coverage: 2,
        library: "Zod",
        score: 0.5,
        slower: 1,
        tiedFastest: 1,
        tiedFastestScenarios: ["near tie"],
      },
      {
        clearWinScenarios: ["clear winner"],
        clearWins: 1,
        coverage: 3,
        library: "Valibot",
        score: 1,
        slower: 1,
        tiedFastest: 0,
        tiedFastestScenarios: [],
      },
    ])
  })

  test("rejects duplicate measurements and invalid tie bands", () => {
    expect(() =>
      scoreComparison([
        { library: "Kern", medianNanoseconds: 1, scenario: "parse" },
        { library: "Kern", medianNanoseconds: 2, scenario: "parse" },
      ]),
    ).toThrow("Duplicate comparison measurement")
    expect(() => scoreComparison([], -1)).toThrow(RangeError)
  })
})
