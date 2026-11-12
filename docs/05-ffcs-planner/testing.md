# FFCS Planner — Testing Map

> **Run:** `pnpm run test -- ffcs` (or any narrower filename filter). ~37 suites, the largest
> the repo owns. The share-link round-trip is the most important invariant in the whole suite.

## What each family pins

| Suites                                                                                  | Invariant                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ffcsGenerate*.test.ts`, `ffcsGenerate.facultyPriority`, `ffcsGenerationRun.dropLadder` | deterministic cartesian search; half-days floor; faculty ranking; drop ladder policies |
| `ffcsShare*.test.ts` / `ffcsShareInput*.test.tsx`                                       | compress→encode→decode round-trip; version gate; raw-code parsing                      |
| `ffcsSettings.test.ts`                                                                  | sanitization of corrupt stored JSON; defaults merge                                    |
| `ffcs-embedded.test.ts`                                                                 | CSV parsing correctness for all shipped semesters                                      |
| `ffcsCatalogFilters`, `buildCurriculumIndex`, `slotIndex`                               | catalog chip behaviors; slot classification                                            |
| `ffcsTab.render`, `ffcsTab.render.test.tsx`                                             | the planner tab mounts; semester switch paths                                          |
| `ffcsGeneratorSubpage.render`                                                           | generator screen; drop-ladder UX states                                                |
| `ffcsFriends*`, `ffcsClassmates`                                                        | social pairing behavior (see `05-ffcs-friends/`)                                       |
| `ffcsDossierSubpage`, `exportTimetable*`, `exportClashReport`                           | exports produce parseable artifacts (deterministic snapshots avoided — asserts shape)  |
| `ffcsCatalogCurriculum.hook` / `ffcsCatalogFilters.render`                              | curriculum backfill effect behavior                                                    |

## When you touch the generator

Run `pnpm run test -- ffcs` **and** `pnpm run test -- timetable`. The ranking-profile suite
(`ffcsRanking`) is the most fragile — expect to update fixture orders deliberately, never by
snapshot-reject.

## Quiz

1. Student reports: "my shared link opens to an empty week on their phone". Name the three
   test files most likely to catch the regression.
