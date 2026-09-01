# @lithekit/validation

Zero-dependency, inferred Standard Schema validation for TypeScript.

```ts
import { object, string } from "@lithekit/validation"

const User = object({ name: string().trim().min(2) })
const result = User.safeParse(input)
```

See the [Lithekit documentation](https://sousaivan99.github.io/lithekit/modules/validation/).
