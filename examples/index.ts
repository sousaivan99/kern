import { runArrayExamples } from "./array.js"
import { runAsyncExamples } from "./async.js"
import { runDateExamples } from "./date.js"
import { runMoneyExamples } from "./money.js"
import { runNumberExamples } from "./number.js"
import { runObjectExamples } from "./object.js"
import { runStringExamples } from "./string.js"
import { runValidationExamples } from "./validation.js"

console.log("Kern module examples")
runValidationExamples()
runMoneyExamples()
runDateExamples()
runNumberExamples()
runStringExamples()
runArrayExamples()
runObjectExamples()
await runAsyncExamples()
