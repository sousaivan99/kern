import { formBenchmarks } from "./form.bench.js"
import { runBenchmarks } from "./harness.js"
import { moduleComparisonBenchmarks } from "./module-compare.bench.js"
import { primitiveBenchmarks } from "./primitives.bench.js"
import { validationBenchmarks } from "./validation.bench.js"
import { validationComparisonBenchmarks } from "./validation-compare.bench.js"

await runBenchmarks([
  ...formBenchmarks,
  ...moduleComparisonBenchmarks,
  ...primitiveBenchmarks,
  ...validationBenchmarks,
  ...validationComparisonBenchmarks,
])
