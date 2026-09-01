# Security Policy

## Supported versions

Each Lithekit package's 1.x line is actively supported. Critical fixes are provided according to the
`SUPPORT.md` stored in that package directory.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue, pull request, discussion, or
other public channel.

Use GitHub's
[private vulnerability reporting form](https://github.com/sousaivan99/lithekit/security/advisories/new).
GitHub requires you to sign in before opening the form.

Include as much of the following as you can:

- the affected Lithekit version, module, and API;
- a minimal reproduction or proof of concept;
- the impact and who could be affected;
- the runtime, operating system, and other relevant environment details;
- any known workaround or suggested mitigation;
- whether you want to be credited in a future advisory.

Do not include secrets, personal data, or data belonging to other people in the report. If the
reproduction requires sensitive material, describe it first so a safer exchange can be arranged.

You should receive an acknowledgement within five business days. Confirmed reports will be
coordinated privately until a fix and advisory are ready. Please allow a reasonable remediation
window before publishing details.

GitHub private vulnerability reports create a private repository advisory where the report and
remediation can be coordinated without opening a public issue.

## Security boundaries

- Validation establishes documented data-shape contracts; it does not sanitize HTML, SQL, shell
  commands, URLs, or application-specific content.
- `string().url()` validates URL syntax and does not restrict protocols or destinations.
- `deepFreeze()` supports plain data only and is not an isolation or authorization boundary.
- Money helpers preserve integer minor-unit arithmetic but do not attach or verify currency
  identity.
