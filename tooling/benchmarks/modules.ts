import { runBenchmarks } from "./harness.js"
import { moduleComparisonBenchmarks } from "./module-compare.bench.js"

await runBenchmarks(moduleComparisonBenchmarks)
