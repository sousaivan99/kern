import { field, type ModelShape, model } from "../runtime.js"

const wideShape = (size: number): ModelShape => {
  const shape: Record<string, ReturnType<typeof field.number>> = {}
  for (let index = 0; index < size; index += 1) {
    shape[`field${index}`] = field.number().integer().min(0)
  }
  return shape
}

export const Wide10 = model("Wide10", wideShape(10))
export const Wide100 = model("Wide100", wideShape(100))
export const Wide1000 = model("Wide1000", wideShape(1_000))
