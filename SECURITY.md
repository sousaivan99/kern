# Security Policy

## Supported versions

Kern is pre-1.0. Security fixes are provided for the latest published minor release only.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue. Use the repository's
[private vulnerability reporting](https://github.com/sousaivan99/kern/security/advisories/new) to
send the affected API, reproduction steps, impact, and any suggested mitigation.

You should receive an acknowledgement within five business days. Confirmed reports will be
coordinated privately until a fix and advisory are ready.

## Security boundaries

- Validation establishes documented data-shape contracts; it does not sanitize HTML, SQL, shell
  commands, URLs, or application-specific content.
- `string().url()` validates URL syntax and does not restrict protocols or destinations.
- `deepFreeze()` supports plain data only and is not an isolation or authorization boundary.
- Money helpers preserve integer minor-unit arithmetic but do not attach or verify currency
  identity.
