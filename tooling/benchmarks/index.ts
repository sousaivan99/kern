import { runBenchmarks } from "./harness.js"
import {
  modelCompilerBenchmarks,
  modelCompilerGenerationBenchmarks,
} from "./model-compiler.bench.js"
import { moduleComparisonBenchmarks } from "./module-compare.bench.js"
import { primitiveBenchmarks } from "./primitives.bench.js"
import { validationBenchmarks } from "./validation.bench.js"
import { validationComparisonBenchmarks } from "./validation-compare.bench.js"

await runBenchmarks([
  ...modelCompilerBenchmarks,
  ...modelCompilerGenerationBenchmarks,
  ...moduleComparisonBenchmarks,
  ...primitiveBenchmarks,
  ...validationBenchmarks,
  ...validationComparisonBenchmarks,
])
