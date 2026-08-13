import * as root from "@kern/core"
import * as arrayModule from "@kern/core/array"
import * as asyncModule from "@kern/core/async"
import * as dateModule from "@kern/core/date"
import * as moneyModule from "@kern/core/money"
import * as numberModule from "@kern/core/number"
import * as objectModule from "@kern/core/object"
import * as stringModule from "@kern/core/string"
import * as validationModule from "@kern/core/validation"

const modules = [
  root,
  arrayModule,
  asyncModule,
  dateModule,
  moneyModule,
  numberModule,
  objectModule,
  stringModule,
  validationModule,
]
if (modules.some((module) => Object.keys(module).length === 0)) {
  throw new Error("A public package subpath had no exports")
}
if (moneyModule.formatMoney(1099, "USD", { locale: "en-US" }) !== "$10.99") {
  throw new Error("Packed money subpath did not execute correctly")
}
if (
  validationModule.object({ name: validationModule.string() }).parse({ name: "Ada" }).name !== "Ada"
) {
  throw new Error("Packed validation subpath did not execute correctly")
}
