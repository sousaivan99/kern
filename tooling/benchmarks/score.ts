export interface ComparisonMeasurement {
  readonly library: string
  readonly medianNanoseconds?: number
  readonly scenario: string
  readonly unsupported?: string
}

export interface ComparisonScoreRow {
  readonly clearWinScenarios: readonly string[]
  readonly clearWins: number
  readonly coverage: number
  readonly library: string
  readonly score: number
  readonly slower: number
  readonly tiedFastest: number
  readonly tiedFastestScenarios: readonly string[]
}

export interface ComparisonScore {
  readonly excludedScenarios: readonly string[]
  readonly rows: readonly ComparisonScoreRow[]
  readonly scoredScenarios: number
  readonly tieBandPercent: number
  readonly totalScenarios: number
}

interface MutableScoreRow {
  readonly clearWinScenarios: string[]
  clearWins: number
  coverage: number
  readonly library: string
  score: number
  slower: number
  tiedFastest: number
  readonly tiedFastestScenarios: string[]
}

export const scoreComparison = (
  measurements: readonly ComparisonMeasurement[],
  tieBandPercent = 10,
): ComparisonScore => {
  if (!Number.isFinite(tieBandPercent) || tieBandPercent < 0) {
    throw new RangeError("Comparison tie band must be a non-negative finite percentage")
  }

  const libraries = [...new Set(measurements.map((measurement) => measurement.library))]
  const scenarios = new Map<string, ComparisonMeasurement[]>()
  for (const measurement of measurements) {
    const entries = scenarios.get(measurement.scenario) ?? []
    if (entries.some((entry) => entry.library === measurement.library)) {
      throw new Error(
        `Duplicate comparison measurement for ${measurement.library}: ${measurement.scenario}`,
      )
    }
    entries.push(measurement)
    scenarios.set(measurement.scenario, entries)
  }

  const mutableRows = new Map<string, MutableScoreRow>(
    libraries.map((library) => [
      library,
      {
        clearWinScenarios: [],
        clearWins: 0,
        coverage: 0,
        library,
        score: 0,
        slower: 0,
        tiedFastest: 0,
        tiedFastestScenarios: [],
      },
    ]),
  )
  const excludedScenarios: string[] = []
  let scoredScenarios = 0
  const tieMultiplier = 1 + tieBandPercent / 100

  for (const [scenario, entries] of scenarios) {
    const supported = entries.filter(
      (entry): entry is ComparisonMeasurement & { readonly medianNanoseconds: number } =>
        entry.unsupported === undefined &&
        entry.medianNanoseconds !== undefined &&
        Number.isFinite(entry.medianNanoseconds) &&
        entry.medianNanoseconds > 0,
    )
    for (const entry of supported) {
      const row = mutableRows.get(entry.library)
      if (row) row.coverage += 1
    }

    if (supported.length !== libraries.length || entries.length !== libraries.length) {
      excludedScenarios.push(scenario)
      continue
    }

    scoredScenarios += 1
    const fastestMedian = Math.min(...supported.map((entry) => entry.medianNanoseconds))
    const tiedFastest = supported.filter(
      (entry) => entry.medianNanoseconds <= fastestMedian * tieMultiplier,
    )
    const tiedLibraries = new Set(tiedFastest.map((entry) => entry.library))

    if (tiedFastest.length === 1) {
      const winner = mutableRows.get(tiedFastest[0]?.library ?? "")
      if (winner) {
        winner.clearWins += 1
        winner.clearWinScenarios.push(scenario)
        winner.score += 1
      }
    } else {
      const pointShare = 1 / tiedFastest.length
      for (const entry of tiedFastest) {
        const row = mutableRows.get(entry.library)
        if (!row) continue
        row.score += pointShare
        row.tiedFastest += 1
        row.tiedFastestScenarios.push(scenario)
      }
    }

    for (const entry of supported) {
      if (tiedLibraries.has(entry.library)) continue
      const row = mutableRows.get(entry.library)
      if (row) row.slower += 1
    }
  }

  return {
    excludedScenarios,
    rows: libraries.map((library) => {
      const row = mutableRows.get(library)
      if (!row) throw new Error(`Missing comparison score row for ${library}`)
      return row
    }),
    scoredScenarios,
    tieBandPercent,
    totalScenarios: scenarios.size,
  }
}
