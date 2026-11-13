# 16 — Adapters (payload-shaping)

> **In one line:** all cross-version payload adaptation lives in `sync-engine/operations.ts`
> adapters — everything downstream may assume normalized shapes.
> **Read:** `operations.ts` lines around `adaptUnifiedGradesResponse`, `extractExamSchedule`,
> `extractRegistrationSchedule`, `extractWishlist`, `extractSimpleFeedback`, `extractDetailedFeedbackStatus`,
> and `applyUnifiedGrades`.

## Adapter table

| Adapter                              | Signature                      | Purpose                                                                                                                                |
| ------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `adaptUnifiedGradesResponse(res)`    | → `{gradesSummary, allGrades}` | one `/grades` response → both canonical shapes; reconstructs effectiveGrades; survives semesters vs history vs grades nesting variance |
| `extractExamSchedule(res)`           | → `schedule?`                  | section=schedule, tolerant of missing `success` when nested                                                                            |
| `extractRegistrationSchedule(res)`   | → passthrough-ish              | registration receipt payload for `ProfileModals` / `ProfileStatusCards`                                                                |
| `extractWishlist(res)`               | → `wishlist?`                  | `.wishlist` field; leaves full object otherwise                                                                                        |
| `extractSimpleFeedback(res)`         | → `feedback?`                  | `{MidSem, EndSem}` quick view for the profile badge                                                                                    |
| `extractDetailedFeedbackStatus(res)` | → `feedbackStatus?`            | per-semester table for `FeedbackStatusModal`                                                                                           |

## Design posture

Adapters are **lossy on purpose**: if we keep everything, every consumer keeps paying for union types.
Feed the atoms only what they need; keep the raw in `storage` caches when useful for debugging.

## What "wrong but tolerated" looks like

`semesters` may live at `.semesters` or `.history` or `.grades` (three observed name variants) —
try all three, never crash. `overall.cgpa` may be numberish or an object — pass through untouched.

## Quiz

1. Which adapter would you extend to add one new effective-grade field, and what else must change?
2. Why keep the raw in `storage` instead of upgrading every consumer to a union type?
