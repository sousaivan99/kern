# Semantic versioning policy

Kern follows Semantic Versioning 2.0.0 after `1.0.0`: published versions use
`MAJOR.MINOR.PATCH`, and a published version is never replaced or republished.

## What the public contract includes

The compatibility contract covers:

- package entrypoints listed in `package.json#exports`;
- exported runtime functions, classes, and values;
- exported TypeScript types and their documented inference behavior;
- documented parameters, return values, defaults, mutation behavior, and thrown error classes;
- validation issue shapes, codes, and paths;
- documented runtime and TypeScript support baselines.

Undocumented implementation details, benchmark results, source-file locations, internal types,
and exact bundle bytes are not public API. Locale-sensitive text produced by `Intl` may vary with a
runtime's locale data where the documentation does not promise an exact string.

## Patch releases

A patch release fixes bugs, security issues, documentation, declarations that do not alter the
documented type contract, or runtime compatibility without intentionally changing valid documented
usage.

A correctness fix may change behavior that contradicted the existing documentation or tests. The
changelog must call this out when consumers could have depended on the incorrect behavior.

## Minor releases

A minor release adds backward-compatible helpers, entrypoints, options, accepted inputs, or type
capabilities. Existing documented calls must continue to compile and behave as documented.

TypeScript changes receive the same compatibility review as runtime changes. A type change that
breaks valid consumer code is not considered minor merely because emitted JavaScript is unchanged.

## Major releases

A major release may remove or rename exports, change documented defaults or units, narrow accepted
inputs, alter output or error contracts, drop a supported runtime baseline, or otherwise require
consumer changes.

Breaking changes should be deprecated in a prior minor release when practical. The major release's
changelog must explain the migration.

## Prereleases

Prerelease versions such as `2.0.0-rc.1` may change before the corresponding stable release. They
are published under an npm prerelease tag and do not replace the stable `latest` release.

## Release records

`packages/kern/package.json` is the source of truth for the next version. Every stable release must
have a matching changelog section, immutable npm artifact, Git tag, and GitHub release.
