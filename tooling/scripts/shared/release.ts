export interface ReleaseContractInput {
  readonly changelog: string
  readonly latestVersion: string
  readonly packageChanged: boolean
  readonly version: string
}

const parseVersion = (value: string): readonly [number, number, number] => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(value)
  if (!match) throw new Error(`Invalid stable semantic version: ${value}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export const compareVersions = (left: string, right: string): number => {
  const leftParts = parseVersion(left)
  const rightParts = parseVersion(right)
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = (leftParts[index] as number) - (rightParts[index] as number)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

export const validateReleaseContract = ({
  changelog,
  latestVersion,
  packageChanged,
  version,
}: ReleaseContractInput): { readonly releaseRequired: boolean } => {
  parseVersion(version)
  parseVersion(latestVersion)
  if (!packageChanged) return { releaseRequired: false }
  if (compareVersions(version, latestVersion) <= 0) {
    throw new Error(`Package version ${version} must be newer than ${latestVersion}`)
  }
  if (!changelog.includes(`## [${version}]`)) {
    throw new Error(`Changelog is missing a ${version} release section`)
  }
  if (!changelog.includes(`[${version}]:`)) {
    throw new Error(`Changelog is missing the ${version} comparison link`)
  }
  if (!changelog.includes(`[Unreleased]:`) || !changelog.includes(`v${version}...HEAD`)) {
    throw new Error(`Unreleased comparison link must start at v${version}`)
  }
  return { releaseRequired: true }
}
