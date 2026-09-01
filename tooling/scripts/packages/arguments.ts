export const selectedPackageId = (): string | undefined => {
  const argument = process.argv.find((candidate) => candidate.startsWith("--package="))
  return argument?.slice("--package=".length)
}
