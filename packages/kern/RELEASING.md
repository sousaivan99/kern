# Releasing `@sousaivan/kern`

## Branch flow

`main` is the development branch. `prod` is the release branch.

1. Open a pull request into `main` for normal development.
2. Prepare a release by updating `packages/kern/package.json` and `CHANGELOG.md` on `main`.
3. Open a pull request from `main` into `prod`.
4. CI runs the complete quality, test, package, documentation, framework, and runtime matrix for
   the pull request.
5. Merge only after the required `check` job passes.
6. The merge commit runs CI again on `prod`.
7. `.github/workflows/release.yml` receives that successful CI result, checks out the exact tested
   commit, verifies that its stable version is new, verifies the package artifact, publishes it to
   npm with provenance, and creates the matching GitHub tag and release.

Configure a GitHub ruleset for `prod` that requires pull requests, blocks direct pushes and force
pushes, and requires the `check` status. The workflow intentionally does not guess whether an
unprotected push was a merge; branch protection provides that guarantee.

## npm setup

The npm user `sousaivan` owns the personal `@sousaivan` scope and must grant publish access to
`@sousaivan/kern`.

Because the package does not exist before its first publication, add a short-lived granular npm
access token as the `production` environment secret `NPM_TOKEN` for the initial release. In npm,
choose the personal user `sousaivan` (not an organization), set **Packages and scopes** to
**Read and write** with **All Packages**, enable **Bypass 2FA**, and remove the token immediately
after the first successful publish.

After the package exists, configure its npm trusted publisher with:

- provider: GitHub Actions;
- organization/user: `sousaivan99`;
- repository: `kern`;
- workflow filename: `release.yml`;
- environment: `production`;
- allowed action: `npm publish`.

The release job has `id-token: write` permission and uses npm 11.6.2 on Node 24, so later releases
authenticate with short-lived OIDC credentials. Configure required reviewers on the GitHub
`production` environment if a human approval is desired immediately before publication.

## Repository security setup

The public repository has GitHub private vulnerability reporting enabled, and the root
`SECURITY.md` directs reports to it. Before each major release, visit the repository's **Security →
Advisories** page from a non-admin account and verify that **Report a vulnerability** opens the
private reporting form. Do not disable private vulnerability reporting without first replacing
every direct reporting link with another working private channel.

## Version rules

- Stable `prod` releases must use an exact `MAJOR.MINOR.PATCH` version with no prerelease suffix.
- The version must have a matching `## [version]` changelog section.
- npm versions are immutable; the workflow refuses to publish an existing version.
- A failed release is fixed with a new commit. If npm already accepted the artifact, increment the
  version instead of attempting to overwrite it.

See [SEMVER.md](./SEMVER.md) for compatibility rules and [SUPPORT.md](./SUPPORT.md) for maintenance
commitments.
