import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { compileModels, serializeArtifact } from "./compiler.js"
import * as modelExports from "./models.js"

export const generateModelArtifacts = () =>
  compileModels(modelExports, {
    runtimeImport: "../runtime.js",
    sourceImport: "../models.js",
    sourceImports: {
      AdvancedUser: "../models/advanced-user.js",
      RuntimeOnlyUser: "../models/runtime-only-user.js",
      User: "../models/user.js",
      UserBatch: "../models/user-batch.js",
      Wide10: "../models/wide.js",
      Wide100: "../models/wide.js",
      Wide1000: "../models/wide.js",
    },
  })

if (import.meta.main) {
  const outputDirectory = join(import.meta.dir, "generated")
  const artifacts = generateModelArtifacts()
  await rm(outputDirectory, { force: true, recursive: true })
  await mkdir(outputDirectory, { recursive: true })
  await Promise.all([
    writeFile(join(outputDirectory, "models.ts"), artifacts.registrySource),
    ...Object.entries(artifacts.modelSources).map(([file, source]) =>
      writeFile(join(outputDirectory, file), source),
    ),
    ...Object.entries(artifacts.validatorSources).map(([file, source]) =>
      writeFile(join(outputDirectory, file), source),
    ),
    ...Object.entries(artifacts.validatorDeclarations).map(([file, source]) =>
      writeFile(join(outputDirectory, file), source),
    ),
    writeFile(join(outputDirectory, "models.schema.json"), serializeArtifact(artifacts.jsonSchema)),
    writeFile(join(outputDirectory, "openapi.json"), serializeArtifact(artifacts.openapi)),
    writeFile(join(outputDirectory, "forms.json"), serializeArtifact(artifacts.forms)),
    writeFile(join(outputDirectory, "examples.json"), serializeArtifact(artifacts.examples)),
    writeFile(join(outputDirectory, "report.json"), serializeArtifact(artifacts.report)),
  ])

  for (const model of artifacts.report) {
    console.log(`✓ ${model.modelName}: ${model.mode}`)
    for (const notice of model.notices) console.log(`  Note: ${notice}`)
  }
  console.log(`Generated ${artifacts.report.length} models in ${outputDirectory}`)
}
