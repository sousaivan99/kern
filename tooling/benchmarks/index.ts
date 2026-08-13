import { runBenchmarks } from "./harness.js"
import { primitiveBenchmarks } from "./primitives.bench.js"
import { validationBenchmarks } from "./validation.bench.js"

runBenchmarks([...primitiveBenchmarks, ...validationBenchmarks])
