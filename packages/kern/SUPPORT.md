# Support policy

## Supported releases

The latest published release in the current major line receives bug fixes, security fixes, and
compatibility maintenance. New features are released from the current development line.

When a new major version is published, the previous major receives critical security fixes for six
months. Other fixes are provided only when maintainers explicitly announce a longer window. This
policy is a maintenance commitment, not a commercial service-level agreement.

| Release line | Status |
| --- | --- |
| `1.x` | Actively supported |
| `<1.0` | Unpublished development versions; unsupported |

Use the newest patch release before reporting a problem.

## Supported environments

Kern 1.x supports:

- TypeScript 5.0 and newer;
- Node.js 22 and newer;
- Bun 1.3 and newer;
- the current stable Deno release through npm compatibility;
- modern evergreen browsers with ES2022, `Intl`, and Web Abort APIs.

The CI matrix directly checks Node 22/24/26, minimum/current Bun, current Deno, Chromium, minimum
and current TypeScript, and the documented timezone corpus. Runtime-native locale and timezone data
can still produce platform-specific display differences.

Dropping a documented baseline normally requires a major release. An upstream end-of-life or
unfixable security issue may require an earlier change, which will be announced in the changelog.

## Getting help and reporting bugs

Search existing GitHub issues first. If the problem is new, open an issue with:

- the Kern, runtime, and TypeScript versions;
- the smallest reproducible input and code sample;
- the expected and actual result;
- relevant locale, timezone, framework, and operating-system details.

General implementation help is best handled through a focused GitHub discussion or issue. Support
is provided on a best-effort basis without a guaranteed response time.

Do not report suspected vulnerabilities publicly. Follow the repository
[security policy](https://github.com/sousaivan99/kern/blob/main/SECURITY.md) and use the private
reporting channel documented there.
