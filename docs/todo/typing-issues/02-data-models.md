# Tier 2 — Model the data properly

This is the tier that actually pays rent: it deletes runtime guesswork and makes
a backend shape change fail loudly instead of rendering an empty page.

## 2.1 `AllGradesRes` is missing three fields

**Current state** — `src/types/data/allgrades.d.ts`:

```ts
export type AllGradesRes = {
    semesterId?: string;
    grades?: GradeResultsMap;
    error?: string;
};
```

But the real payload (see `src/data/demoData.json`) also carries `curriculum`,
`effectiveGrades` and `cgpa`. The type doesn't model them, so the consumer has
to discover them at runtime.

**The cost** — `CurriculumPage.tsx` probes **11 candidate paths** for each of
the two arrays, because it can't know which of its three `any` props holds them:

```ts
const findCurriculum = (): CurriculumItem[] => {
  const sources = [
    allGradesData?.curriculum, allGradesData?.cgpa?.curriculum, allGradesData?.grades?.curriculum,
    allGradesData?.data?.curriculum, gradesData?.curriculum, /* …11 total… */
  ];
  for (const src of sources) if (Array.isArray(src) && src.length > 0) return src;
  return [];
};
```

Note the duplicated entry (`gradesData?.grades?.curriculum` appears twice) — a
symptom of code nobody dares delete, because nobody knows which path is live.

**Change** — extend the type to match reality:

```ts
export type AllGradesRes = {
    semesterId?: string;
    grades?: GradeResultsMap;
    error?: string;
    // added
    cgpa?: { cgpa?: string | number; creditsEarned?: string; creditsRequired?: string;
             nonGradedRequirement?: string };
    curriculum?: CurriculumItem[];
    effectiveGrades?: EffectiveGradeItem[];
};
```

Then collapse the probing to the paths that are actually populated. **Verify
which those are before deleting anything** — log the resolved path once in demo
mode, or grep the sync engine's `operations.ts` for where these are written.

**Risk** — medium-low. Deleting a path that *was* live shows an empty page. Gate
it: keep the probe temporarily, assert the new direct path returns the same
array, then delete.

---

## 2.2 Curriculum types belong in `src/types/`

**Current state** — `CurriculumPage.tsx` declares its shapes inline
(`CurriculumItem`, `EffectiveGradeItem`, `BasketItem`, `Basket`,
`CategoryDetail`, `Creds`). `CurriculumCategoriesTab.tsx` declared a **third**
copy of four of them (now deleted per [01](./01-quick-wins.md)).

**Change** — create `src/types/curriculum.ts`, following the pattern already
established by `src/types/payments.ts` (added with the payments redesign):

```ts
export interface CurriculumItem { basketTitle: string; creditsRequired: string; creditsEarned: string }
export interface EffectiveGradeItem { basketTitle: string; distributionType: string;
                                       creditsEarned: string; grade: string; courseCode?: string }
export interface BasketItem { code: string; name: string; credits: number; type?: string }
export interface Basket { title: string; credits: number; items: BasketItem[] }
export interface CategoryDetail { code: string; name: string; baskets: Basket[] }
export interface CurriculumCache { details?: CategoryDetail[]; categories?: unknown[];
                                   totalCredits?: number; pageCsrf?: string }
```

Import from `@/types/curriculum` in every consumer. One definition, one home.

---

## 2.3 The curriculum storage bucket is `unknown`

**Current state** — `src/lib/storage.ts:126-129`:

```ts
curriculum: {
  get: () => getItem<unknown>(KEYS.CURRICULUM),
  set: (data: unknown) => setItem(KEYS.CURRICULUM, data),
  remove: () => removeItem(KEYS.CURRICULUM),
},
```

Every consumer re-parses and re-asserts the cached blob by hand.

**Change**

```ts
curriculum: {
  get: () => getItem<CurriculumCache>(KEYS.CURRICULUM),
  set: (data: CurriculumCache) => setItem(KEYS.CURRICULUM, data),
  remove: () => removeItem(KEYS.CURRICULUM),
},
```

This is the same treatment `tasks` / `pomodoroSessions` already got
(`KEYS.TASKS` in `storage.ts`, typed via `src/types/tasks.ts`).

---

## 2.4 Type the Dashboard prop boundary

**Current state** — `Dashboard.tsx` holds properly typed atoms, then discards the
types at the call site:

```tsx
<CurriculumPage
  marksData={marksData}            // atom is object, prop is `any`
  allGradesData={allGradesData}    // AllGradesRes, prop is `any`
  gradesData={GradesData}          // prop is `any`
  attendance={attendanceData.attendance} // attendanceItem[], prop is `any`
/>
```

and `CurriculumPage` declares all four as `any`.

**Change** — give the component a real signature. `src/types/data/attendance.d.ts`
already models `attendanceItem` properly, and `src/types/data/marks.d.ts` has
`CourseItem`; the marks atom type is the one still loose.

```tsx
interface CurriculumPageProps {
  allGradesData?: AllGradesRes;
  gradesData: GradesRes;
  marksData: MarksRes;
  attendance?: attendanceItem[];
  handleFetchGrades: () => void;
  setActiveSubTab: (tab: string) => void;
  loginToVTOP?: () => Promise<Creds>;
}
```

**Payoff** — when the backend adds a field, the error surfaces in
`Dashboard.tsx` with a real name instead of propagating as `undefined` three
layers down.

---

## Definition of done

- [ ] `src/types/curriculum.ts` exists; no duplicate declarations anywhere
- [ ] `AllGradesRes` models `cgpa` / `curriculum` / `effectiveGrades`
- [ ] Probing reduced to the paths proven live (log first, delete second)
- [ ] `storage.curriculum` typed with `CurriculumCache`
- [ ] `CurriculumPage` props fully typed
- [ ] `npx tsc --noEmit` clean · `npx vitest run` green · visual check in demo mode
