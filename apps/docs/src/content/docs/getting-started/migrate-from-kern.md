---
title: Migrate from Kern
description: Move from Kern subpath imports to independently installable Lithekit packages.
---

Lithekit succeeds Kern as a new package ecosystem. There is no compatibility release and no root
aggregate package. Install only the packages your application imports, then change each import:

| Kern import | Lithekit package |
| --- | --- |
| `@sousaivan/kern/validation` | `@lithekit/validation` |
| `@sousaivan/kern/money` | `@lithekit/money` |
| `@sousaivan/kern/date` | `@lithekit/date` |
| `@sousaivan/kern/number` | `@lithekit/number` |
| `@sousaivan/kern/string` | `@lithekit/string` |
| `@sousaivan/kern/array` | `@lithekit/array` |
| `@sousaivan/kern/object` | `@lithekit/object` |
| `@sousaivan/kern/async` | `@lithekit/async` |

For example:

```bash
npm install @lithekit/validation @lithekit/money
```

```ts
import { object, string } from "@lithekit/validation"
import { formatMoney } from "@lithekit/money"
```

The migrated domain APIs retain their behavior and types. Lithekit packages start at `1.0.0` and
then version independently. Form core and its Vue and React adapters are the exception: they use a
synchronized version and release together.

Published Kern artifacts, Git history, and tags remain available. Kern is not republished under a
compatibility wrapper, because that would force consumers to install code they do not use.
