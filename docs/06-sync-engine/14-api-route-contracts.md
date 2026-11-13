---
title: "API Route Contracts"
description: "the shapes the frontend expects from AmazeCC-API — cataloged here so the frontend never guesses; source of truth lives in AmazeCC-API."
---

# API Route Contracts

> **In one line:** the shapes the frontend expects from AmazeCC-API — cataloged here so the
> frontend never guesses; source of truth lives in AmazeCC-API.
> **Note:** this repo has no API routes; these are client-side expectations, documented for
> handoff. The API repo validates its own side.

## Universal envelope

```json
{ "success": true|false, ...fields }
```

Any `success:false` is a failure even on HTTP 200 (`assertApiSuccess`); `message` carries
English reason text; `error` carries machine-ish text (400 empties).

## The load-bearing routes (from `sync-engine/operations.ts`)

### `POST /api/ffcs` (all-in FFCS bundle)

Body: `{semesterId?, cookies, authorizedID, csrf, section?}`

Response (section=all): `{success, registrationSchedule, feedbackStatus, feedback, wishlist,
schedule, qcmView}` — each adapter extracts its slice (`extractRegistrationSchedule` etc.).

- `section=schedule` → `{schedule: {...CAT/FAT groups}, success}` (+ no semesterId ⇒ 400)
- `section=feedback` → `{feedbackStatus: {...}, feedback: {MidSem:{Curriculum,Course}, EndSem:{…}}}`
  read: `MidSem.Curriculum = !text.includes("not")` — presence means given
- `section=wishlist` → `{semesters: {<text>: parsedHtml-ish, per selected}}`

### `POST /api/grades` (unified — also feeds `all-grades`)

```json
{ "success": true,
  "overall": {"cgpa": {…}, "curriculum": [...]},
  "semesters": {"<semId>": {"gpa": {…}, "grades": [{…, "effective": {…}}]}} }
```

`adaptUnifiedGradesResponse()` normalizes this into the legacy `{gradesSummary, allGrades}`
shapes that atoms/caches already expect (cgpa, effectiveGrades reconstruction, curriculum bool).

### `POST /api/attendance`

Body `{semesterId, cookies, authorizedID, csrf}` → `{attRes: {attendance: [...]}, marksRes: {…}}`.
Drives attendance calendar + percentages atom (`attendanceSummary.ts` = the one formula).

### `POST /api/whoami`

Identity card: `{profileTable, photo, eptSchedule, …}`-ish loosely typed — everything the
profile tab needs in one call (stored as `cache_whoami`).

### `POST /api/social/*`

`social/ffcs-match`, `social/grants`, `social/pull` — typed wrappers in `lib/social/client.ts`;
payloads: handle-derived secrets, class id lists, peer busy maps. See 05-social/.

### `POST /api/marks/stats`

`{classIds: string[]}` → `{success, stats: {<classId>: {mean, σ, topFraction, n, …}}}`.
HMAC-receipted writes reconcile server state (see 11).

## Demo mode

No request fires; atoms are seeded from `demoData.json` with identical shapes — the demo fixture
is the contract, class for class.
