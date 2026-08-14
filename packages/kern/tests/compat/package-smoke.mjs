import * as root from "@sousaivan/kern"
import * as arrayModule from "@sousaivan/kern/array"
import * as asyncModule from "@sousaivan/kern/async"
import * as dateModule from "@sousaivan/kern/date"
import * as moneyModule from "@sousaivan/kern/money"
import * as numberModule from "@sousaivan/kern/number"
import * as objectModule from "@sousaivan/kern/object"
import * as stringModule from "@sousaivan/kern/string"
import * as validationModule from "@sousaivan/kern/validation"

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
if (moneyModule.allocateMoney(100, [1, 1, 1]).join(",") !== "34,33,33") {
  throw new Error("Packed money allocation did not execute correctly")
}
if (
  validationModule.object({ name: validationModule.string() }).parse({ name: "Ada" }).name !== "Ada"
) {
  throw new Error("Packed validation subpath did not execute correctly")
}
if (
  validationModule
    .object({ name: validationModule.string() })
    .strict()
    .safeParse({ name: "Ada", extra: true }).success
) {
  throw new Error("Packed validation object policy did not execute correctly")
}
