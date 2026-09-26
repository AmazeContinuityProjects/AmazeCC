# Tier 1 — Quick wins (no behaviour change)

## 1.1 Enable the unused-symbol checks

**Current state** — `tsconfig.json` has no unused checks at all:

```json
"strict": false,
"noEmit": true,
```

**Why it matters** — every recent redesign had to hunt dead code by hand because
nothing flagged it:

| Dead code | Where |
|---|---|
| 10 unused `lucide-react` imports | `CurriculumPage.tsx` (`BarChart`, `XAxis`, `YAxis`, `Tooltip`, `Layers`, `Sparkles`, `Filter`, `AlertCircle`, `Sliders`, `ListFilter`, `BookMarked`) |
| `GRADE_POINTS` constant | `CurriculumPage.tsx` |
| `typeFilter` state (declared, never read) | `CurriculumPage.tsx` |
| `Card`, `EmptyState`, `Badge`, `Button` imports | `PaymentsTab.tsx` |
| `countLedgerEntries` import | `PaymentsTab.tsx` |
| `academicsToolRedirects`-era `AcademicsHub` import | `Dashboard.tsx:7` |

**Change**

```jsonc
// tsconfig.json — compilerOptions
"noUnusedLocals": true,
"noUnusedParameters": true,
```

**Expect** a burst of errors on first run. Each one is a genuine finding; fix by
deleting the symbol. If a parameter is intentionally unused, prefix it with `_`.

**Verify**

```bash
npx tsc --noEmit -p tsconfig.json   # expect 0 errors
npx eslint src                      # unchanged
npx vitest run
```

**Risk** — none at runtime. Note `noUnusedParameters` will flag React props that
are destructured but unused; `_`-prefix those.

---

## 1.2 Delete the two dead files

Both are verified dead (zero references outside their own definition):

| File | Evidence |
|---|---|
| `src/components/custom/exams/CurriculumCategoriesTab.tsx` | Only self-references. Also holds a **third** copy of the `Category` / `BasketItem` / `Basket` / `CategoryDetail` interfaces. |
| `src/components/custom/exams/AcademicsHub.tsx` | Imported once at `Dashboard.tsx:7`, never rendered. 449 lines of hub UI (CGPA quick stats, degree-progress panel) that no user can reach. |

**Change**

1. `git rm src/components/custom/exams/CurriculumCategoriesTab.tsx`
2. Remove the `AcademicsHub` import from `Dashboard.tsx:7`, then
   `git rm src/components/custom/exams/AcademicsHub.tsx`

**Before deleting AcademicsHub**, confirm the intent isn't "an unfinished
academics menu". If it is wanted back, file it as its own task rather than
leaving it as a dead import that hides 449 lines of design work.

**Verify** — `npx tsc --noEmit -p tsconfig.json`, then `npx next build --webpack`
(the build catches imports that tsc's `include` might miss).

---

## 1.3 Add TypeScript lint rules with a ratchet

**Current state** — `eslint.config.mjs` sets React rules and one architectural
guardrail, but **no `@typescript-eslint` rules at all**:

```js
const eslintConfig = [
  ...nextConfig,
  { rules: { "react-hooks/*": ..., "no-restricted-imports": ["error", {...}] } },
]
```

**Change** — add as warnings first (so the build stays green), then ratchet:

```js
rules: {
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/consistent-type-imports": "warn",
  // next step, after the any count stops falling:
  "no-floating-promises": "warn", // needs type-aware linting
}
```

Type-aware rules (`no-floating-promises`, `no-misused-promises`) require
`parserOptions.project` in the flat config. That is worth adding: several
`api()` calls in this repo are intentionally unawaited inside event handlers,
and this rule is what makes that explicit rather than accidental.

**Verify** — `npx eslint src` and confirm the warning count only decreases over
time. Consider a CI budget: fail if `no-explicit-any` count rises.

---

## Definition of done

- [ ] `noUnusedLocals` + `noUnusedParameters` on, tsc clean
- [ ] `CurriculumCategoriesTab.tsx` deleted
- [ ] `AcademicsHub` import removed and file deleted (or a task filed to revive it)
- [ ] `@typescript-eslint/no-explicit-any` as a warning
- [ ] `npx vitest run` green
