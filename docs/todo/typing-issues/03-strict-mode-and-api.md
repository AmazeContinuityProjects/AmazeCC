# Tier 3 — API responses, then `strict: true`

Both are scheduled last on purpose: they are the two changes most likely to
produce a large diff, and doing them before Tier 2 means fixing noise instead of
real types.

## 3.1 `api()` returns `any`

**Current state** — `src/lib/sync-engine/index.ts` exports
`apiRequest as api`; the return type is untyped. Every consumer re-asserts the
shape by hand, and a backend change surfaces as a blank screen:

```ts
const result: any = await api("curriculum", { method: "POST", ... });
if (result && result.success !== false) setCurricDetails(result.details || []);
```

`result.details` is `any`, so `|| []` silently converts "the field was renamed"
into "no curriculum data" — which is the failure mode that let the old
curriculum page rot unnoticed.

**Recommended approach — validate once at the engine boundary**, not per call
site. `src/lib/sync-engine/operations.ts` is already the single funnel where
module responses are written into atoms, so that is the one place to attach
schemas:

```ts
// sketch
const curriculumSchema = z.object({
  success: z.boolean().optional(),
  details: z.array(categoryDetailSchema).optional(),
  categories: z.array(z.unknown()).optional(),
  totalCredits: z.number().optional(),
  pageCsrf: z.string().optional(),
});
```

**Sequencing**

1. Add zod (or an equivalent) and validate **one** endpoint (`curriculum`)
   behind a flag, logging parse failures instead of throwing.
2. Once the schema is trusted, export `type CurriculumResponse = z.infer<...>`
   and let `api` be generic: `api<T>(path, opts): Promise<T>`.
3. Roll out per module: `payments`, `all-grades`, `marks`, `attendance`,
   `hostel`, `wallet`.

**Why boundary validation beats per-call typing** — a typed `api<T>()` with no
runtime check still lies when the server disagrees. Validating at the funnel
means every consumer gets a correct type *and* a correct value.

**Risk** — medium. A strict schema will reject responses that "work today" via
lenient access (extra/missing optional fields). Start with everything
`.optional()` and tighten.

---

## 3.2 `strict: false` is the root cause of a jotai workaround

**Current state** — `tsconfig.json` has `"strict": false`. With
`strictNullChecks` off, `null` is assignable to every type, so this:

```ts
export const officialOdDataAtom = atom<OfficialOdResponse | null>(null);
```

matches jotai's **read-only** atom overload instead of the writable one, and
`setOfficialOdData(x)` becomes a type error. The repo works around it in three
places with casts and an explanatory comment:

| File | Line | Cast |
|---|---|---|
| `src/store/dataAtoms.ts` | 20 | `null as unknown as OfficialOdResponse` |
| `src/store/dataAtoms.ts` | 28 | `atom<string \| null>(null as unknown as string \| null)` |
| `src/store/uiAtoms.ts` | 22 | `null as unknown as { title: string; nonce: number }` |

With `strictNullChecks` on, all three are unnecessary and the comments can go.

**Enable it in slices, not one commit**

1. `strict: true` but keep `strictNullChecks: false` — turn on the other strict
   family members first (`noImplicitAny`, `strictFunctionTypes`,
   `strictBindCallApply`). These are cheap and rarely cascade.
2. Then `strictNullChecks: true` **file by file**, newest first (the types
   already added — `src/types/tasks.ts`, `src/types/payments.ts` — should need
   almost nothing).
3. Only then consider `noUncheckedIndexedAccess`, which is valuable here
   because a lot of this code indexes into `any` payloads.

**Practical trick** — for files not yet migrated, `// @ts-nocheck` at the top is
worse than it sounds (it disables checking for the whole file), so prefer
per-file `strictNullChecks` opt-outs via a separate tsconfig only if the error
count is unmanageable. In practice this repo is small enough to just fix them.

**What you will gain** — the null-related class of bug becomes visible. Given
this codebase's defensive `parseFloat(...) || 0` style and `Array.isArray(x) ? x
: []` guards (written because the compiler couldn't help), a good number of
those become provably unnecessary once types are real.

**Risk** — high effort, low runtime risk. Do it as a dedicated branch.

---

## Definition of done

- [ ] `curriculum` endpoint validated at the `sync-engine` boundary
- [ ] `api` is generic and returns validated types
- [ ] `noImplicitAny` + `strictFunctionTypes` + `strictBindCallApply` on
- [ ] `strictNullChecks: true` across `src`
- [ ] The three `as unknown as` atom casts removed
- [ ] `npx tsc --noEmit` clean · full suite green · `next build --webpack` green
