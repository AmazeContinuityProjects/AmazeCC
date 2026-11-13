---
title: "TypeScript in Ten Minutes"
description: "JavaScript with a spellchecker that catches wrong _shapes_ of data before the browser ever sees them."
---

# TypeScript in Ten Minutes

> **In one line:** JavaScript with a spellchecker that catches wrong _shapes_ of data before
> the browser ever sees them.
> **Audience:** everyone. **Reading time:** ~10 min.

## The 80% you must be fluent in

**Types.** Every value has a type. Annotate when it helps:

```ts
const semesterId: string = "CH20262705";
const percentages: number[] = [92, 88, 76.5];
```

**Objects via `interface` / `type`:**

```ts
interface ParsedCourse {
  code: string;
  title?: string; // ? = may be absent
  credits: number;
}
```

**Generics.** "A container that works for any element type": `useState<number>(0)`,
`Array<ParsedCourse>`.

**Unions.** `"dark" | "light" | "auto"` — exhaustiveness is how we model UI modes.

**`any`** — the off switch for the type system. This repo uses it _honestly_ (~hundreds of
sites), especially at the VTOP boundary where the API sends you whatever it sends you.
ESLint only warns, never errors. Don't imitate the best of it; minimize yours.

## What this repo turned **off**, and why

`tsconfig.json` sets **strictNullChecks: false**. Meaning `string | null` and `string` both
pass wherever `string` is expected. This is a historic, deliberate posture: VTOP payloads are
loosely typed and the app grew before strictness was affordable. Consequences you must know:

- `data.foo.bar` compiles even if `foo` was null — you will get runtime `TypeError`s; the
  crash are real, the compiler just won't pre-warn you.
- When in doubt, add `?.` and `??` defensively. The compiler won't force you.
- `Record<string, unknown>` beats `any` when you can manage it.

## Reading types in this repo — three that will appear everywhere

```ts
// src/lib/sync-engine/types.ts
export interface Ids {
  VtopUsername: string;
  VtopPassword: string;
  MoodleUsername: string;
  MoodlePassword: string;
}
export interface VtopCreds {
  cookies?: string | string[];
  authorizedID?: string;
  csrf?: string;
  fetchedAt?: number;
}
export type AuthDomain = "vtop" | "eventhub";
```

And **branded DTO imports** like `@/types/data/grades` describe what AmazeCC-API returns —
copy those shapes when writing code against the API.

## Quiz

1. What does `interface X { a?: string }` tell the compiler about `a`?
2. Why does `strictNullChecks: false` change how defensively you must write?
3. When VTOP gives you `{}` unexpectedly, what is the _runtime_ cost of not caring?
