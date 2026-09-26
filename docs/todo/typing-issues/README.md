# Typing debt — index

Working notes for the TypeScript hygiene backlog. Every claim here was verified
against the repo (line numbers as of the tasks/payments/curriculum redesign
work). Nothing here is a rendering bug; these are the reasons those bugs could
exist and survive review.

## The three tiers

| Tier | File | What | Risk | Effort |
|---|---|---|---|---|
| 1 | [01-quick-wins.md](./01-quick-wins.md) | Compiler + lint flags that would have caught the dead code; delete 2 dead files | none | ~1 hour |
| 2 | [02-data-models.md](./02-data-models.md) | Real types for the all-grades payload, curriculum types, typed prop boundaries | low | ~1 day |
| 3 | [03-strict-mode-and-api.md](./03-strict-mode-and-api.md) | Typed API responses, then `strict: true` | medium | multi-PR |

## Why this is worth doing at all

The curriculum page shipped ~55 distinct surface recipes (6 radii, 6 shadows,
13 background recipes, 8 border colours) and 10 unused imports. None of that was
flagged by any tool, because:

- `tsconfig.json` has **no** unused-symbol checks.
- `eslint.config.mjs` contains **zero** TypeScript rules.
- Every data prop on that page was `any`.

The compiler was effectively only checking that JSX prop names existed.

## Ground rules

- One tier per PR. Do not bundle Tier 3 with anything.
- Every PR must keep `npx tsc --noEmit -p tsconfig.json` at zero errors and
  `npx vitest run` green.
- `strictNullChecks` is the single highest-value flag but also the one most
  likely to surface a large diff — it is deliberately scheduled last, once the
  underlying types are real. See [03-strict-mode-and-api.md](./03-strict-mode-and-api.md).
