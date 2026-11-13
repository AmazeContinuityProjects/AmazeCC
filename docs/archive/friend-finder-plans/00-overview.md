---
title: "Overview: friend finder on the Simplified Mobile Home"
---

> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/index.md` for current documentation.

# Overview: friend finder on the Simplified Mobile Home

- **Date:** 2026-11-09
- **Status:** planned (council-critiqued, revised)
- **Repos:** AmazeCC (frontend, `output: "export"`), `../AmazeCC-API` (backend)

## 1. Vision

The friend finder ("Find classmates") currently lives inside the FFCS planner
as a full-page subpage (`FFCSTimetableTab` early-return, deep link
`/ffcs/?open=classmates`). It moves to the **Simplified Mobile Home**: a
quick-tools entry button opens a dedicated `friend-finder` tab, sharing is
**VTOP-verified only**, the list refreshes on **every quick sync**, and the
results are browsed in **two groupings** — by class and by friend — with a
class subpage (faculty, subject details, faculty review, people count) and a
friend bottom sheet (name, reg no, shared-class count, clickable classes).

## 2. Requirements → design

| #   | Requirement                                                                  | Design answer                                                                                                                                       |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Move finder from `/ffcs` to the Simplified Mobile Home                       | Home quick-tools button → new top-level tab `friend-finder` (user-confirmed placement); planner entries removed/redirected; friends manager stays   |
| 2   | Share only VTOP-verified timetables, against semesters (CH20262705 upcoming) | Publish `source: "registered"` only (server reads VTOP at publish); API rejects `planned`; semester allowlist unchanged (`CH20262705`/`CH20262701`) |
| 3   | Once you share, others can share theirs too                                  | Reciprocity already enforced server-side (matches only when discoverable) — unchanged                                                               |
| 4   | Every quick sync grows my list                                               | `broadcastFriendFinderRefresh()` after sync success → open finder re-publishes (registered) or gets; growth itself is server-recomputed per `get`   |
| 5   | Two groupings: by class / by friends (by common classes)                     | Segmented control in the finder tab: `sections[]` (class cards) vs `overlaps[]` (friends ranked by `shared`)                                        |
| 6   | Class subpage: faculty, subject details, faculty review, people count        | Drill-in view from a class card; offering from `sections[].offering`, count = `people.length`, review via `FacultyReviewSheet`                      |
| 7   | Friend bottom sheet: name, reg no, shared count, clickable classes           | `BottomSheet` over `overlaps[]`; **new** `register_no` column returned in overlaps only; shared classes ⊆ caller's sections → class subpage         |
| 8   | Save plan under `docs/friend-finder-plans/`                                  | This folder                                                                                                                                         |

## 3. Decisions

### D1 — Verified-only sharing (server-enforced)

- API: `publish` with `source !== "registered"` → `400 planned_sharing_disabled`
  ("Only VTOP-verified timetables can be shared").
- One-time `DELETE … WHERE source = 'planned'` runs inside
  `ensureFfcsMatchSchema` (accepted product decision — requirement 2 says only
  verified sharing exists; the join card copy tells re-joiners why they must
  re-share. No per-user notice is queued.)
- App: `ClassmatesRequest` loses the planned variant; the publish picker in the
  new tab offers only "My registered timetable" (copied from
  `FFCSClassmatesSection.tsx:486-549`, planned plans dropped).
- `MatchSource` type and the `source` CHECK constraint **stay as-is**:
  the route is the single enforcement point, and rewriting a CHECK on a live
  table buys nothing the route does not already guarantee.
- `validatePlan` (pure, tested) stays with a comment that planned publishing is
  disabled at the route — no churn deleting tests that still document the rules.
- Semesters: allowlist `FFCS_REPORT_FILES = { CH20262701, CH20262705 }` in the
  API stays; client keeps `classmatesSemester()` (`ffcsClassmates.ts:140-144`,
  winter → `CH20262705`). The upcoming semester is CH20262705.

### D2 — Placement: new top-level tab (user-confirmed 2026-11-09)

The entry button sits on the Simplified Mobile Home quick-tools grid; it opens
a **new top-level tab** `friend-finder`, mirroring the sibling quick tools
(`setActiveTab("free-class")`, `setActiveTab("faculty-schedule")`) and the
`FacultyScheduleTab` "opened from home" back-button precedent
(`faculty_schedule_source = "home"`, `FacultyScheduleTab.tsx:150,260-274`).

Alternatives rejected: More sub-tab (needs `setActiveMoreSubTab` threading
through onboarding; social hub ≠ planner), in-home overlay (new pattern; home
only ever opens sheets or navigates away).

### D3 — Reg no: deliberate privacy-posture change, overlaps only

Requirement 7 mandates reg numbers. Today **no plaintext reg no exists** in the
social tables (`owner_key = maskUserID(regNo)`, random handles). This plan adds
`register_no` to `ffcs_match_entries` and returns it **only in `overlaps[]`** —
i.e. only to reciprocal sharers who already share ≥2 classes with you. Section
rosters (`sections[].people`) stay `{handle, name, source}`.

Four documented invariants must be updated in the same change (see
01-api-changes.md §6): `ffcsMatchDb.ts:10-11`, `socialDb.ts:13-14`,
`ffcsMatch.ts:145`, `docs/ffcs-friend-finder/index.md:48`. Precedent for
plaintext reg no elsewhere in the API: `cabshare_users.reg_number`.

### D4 — "People in her class" = discoverable sharers

The report CSV has no seat-count column, so the count is
`sections[].people.length` — classmates who shared their verified timetable,
are discoverable, and share that class with you. Label it "N classmates here",
never official enrollment.

### D5 — Quick-sync growth semantics (requirement 4, precisely)

Growth is **server-side**: every `get` recomputes matches against all current
entries (`buildState → findCandidates → computeMatches`), so friends who
published since your last look appear on the next fetch, open or not.

The event adds the two things a bare refetch cannot do:

1. After a successful sync, `broadcastFriendFinderRefresh()` fires
   (custom event, pattern copied from `broadcastGlobalSemesterChange`,
   `ffcsReports.ts:200-214`).
2. A **mounted** finder tab listens: `me.joined ? publish(registered) : get`.
   The publish refreshes _my_ published snapshot (picks up add/drop since last
   share) **and** returns the recomputed, grown match list in the same call —
   free when unchanged (`ffcsMatchDb.ts:96,109`), so it only consumes the
   10/day change cap when classes actually changed.

Not mounted → no network call; the next open's mount-`get` shows everyone
current at that moment. No new sync op; `RETIRED_OPS = {"social"}` untouched.

### D6 — Class subpage is a drill-in, not `CourseDetailSubpage`

Every class reachable from **either** grouping is a caller's own section
(`overlaps.sharedClassIds ⊆ my classIds`), so the finder's own `sections[]`
response already carries the offering — **no new endpoint**. The subpage is a
view inside the finder tab (`selectedClassId` state) with a back button;
faculty review reuses `useFacultyReviewSheet` + `FacultyReviewSheet`
(target `{name: faculty, courseCode: code}`, `employeeId` optional).

### D7 — Sign-in round trip via URL param, not the sessionStorage note

The finder is now an in-app tab at `/`, so the guest CTA pushes
`/?signin=1&open=friend-finder` directly:

- `HomeEntryController.tsx:83-91` strips only `signin`, **preserving** `open`.
- A new consumer in `Main.tsx` (next to the existing `takeSignInReturn()`
  handling) reads `open=friend-finder` → `setActiveTab("friend-finder")` →
  strips the param. Handles cold deep links (`/?open=friend-finder` from share
  links) and post-login returns alike.

`signInReturn.ts` and `signInReturn.test.ts` **stay untouched**: the
`prepareSignIn` note mechanism remains in use for the standalone `/ffcs`
planner route (`FFCSPageView.tsx:72`), where `ALLOWED_PREFIXES = ["/ffcs"]` is
still exactly right. This resolves the council's sign-in blocker without
widening the allowlist.

### D8 — The planner's friends manager is out of scope

`FFCSFriendsSubpage.tsx` hosts the friends/groups manager (`add`, `friends`,
`groups`) whose data feeds `FFCSGeneratorSubpage` social scoring
(`FFCSTimetableTab.tsx:2152-2154,3070-3075`) and is covered by 8 tests. Only
the `classmates` section leaves that file. Nothing else in the planner changes
except removing/redirecting the classmates entry points.

## 4. Out of scope

- The retired busy-map sharing (`/api/social/timetable`, `docs/social-tt/`).
- The share-link feature (`timetableShareLink`, `/share/ffcs`).
- Official enrollment/seat counts (data doesn't exist in the report).
- Planned (`source: "planned"`) sharing in any form.
- The planner's friends/groups manager and generator social scoring.

## 5. Related documents

- [../../05-friend-finder/design-note.md](../../05-friend-finder/design-note.md) — feature
  design being moved (update in Phase 4)
- [../../05-ffcs-planner/notes/index.md](../../05-ffcs-planner/notes/index.md) — report CSV shape
- `../social-tt/index.md` — retired sharing feature (context for D5)
