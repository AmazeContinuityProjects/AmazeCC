---
title: "API changes (../AmazeCC-API)"
---

> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/index.md` for current documentation.

# 01 — API changes (`../AmazeCC-API`)

Everything the backend needs for: verified-only publishing, reg no in the
friend sheet, and nothing else. Reciprocity, semester allowlist, rate limits
and matching already work as required.

**Deploy after the app changes are live** (see
[03-build-phases.md](./03-build-phases.md)) — the only breaking step is the
`planned` rejection.

## 1. Identity: carry the reg no (`src/lib/socialCaller.ts`)

`identifyCaller` already computes `regNumber` at line 69
(`profile.registerNo || profile.applicationNumber`) to derive `ownerKey`, but
drops it from the returned `CallerIdentity` (type at `:19-25`). Add
`regNo: string` to the type and return it. No VTOP work — it's already parsed.

## 2. Schema (`src/lib/ffcsMatchDb.ts`)

Inside `ensureFfcsMatchSchema()` (`:20-47`), after the `CREATE TABLE`:

1. **Add the column** — `CREATE TABLE IF NOT EXISTS` never alters an existing
   table, so this is mandatory for live databases:

   ```sql
   ALTER TABLE ffcs_match_entries
     ADD COLUMN IF NOT EXISTS register_no TEXT NOT NULL DEFAULT '';
   ```

2. **One-time planned-row cleanup** (decision D1):

   ```sql
   DELETE FROM ffcs_match_entries WHERE source = 'planned';
   ```

   Both run once per instance (`schemaReady` guard) on first hit — the repo's
   inline-DDL house style, no migrations, no env vars.

3. **Plumbing:**
   - `ENTRY_COLUMNS` (`:69`) += `register_no`
   - `toEntry` (`:58-67`) maps it
   - `publishEntry` (`:87-114`): signature += `regNo: string`; both the
     `INSERT` column list/values and the `DO UPDATE SET` write it. The
     `unchanged` predicate (`:96`) compares only `class_ids`/`source` — a
     reg-no backfill never counts as a daily change (see §3).
   - New `backfillRegisterNo(ownerKey, semesterId, regNo)`:

     ```sql
     UPDATE ffcs_match_entries SET register_no = $1
      WHERE owner_key = $2 AND semester_id = $3 AND register_no = ''
     ```

     Dedicated statement, **not** through `publishEntry` — never touches
     `changes_in_window` (council minor: backfill must not consume the cap).

   - `findCandidates` (`:146-170`): `SELECT` += `e.register_no`; returned
     `MatchCandidate` carries it.

## 3. Route (`src/app/api/social/ffcs-match/route.ts`)

1. **Reject planned publishing** (replaces the branch at `:208-210`):

   ```ts
   if (source !== "registered") {
     return fail(400, "planned_sharing_disabled", {
       detail: "Only VTOP-verified timetables can be shared",
     });
   }
   ```

   The `registered` path (`registeredClassIds`, `:99-123`, VTOP
   `processViewTimeTable`, ≤ `MAX_REGISTERED_CLASSES`) is unchanged.

2. **Backfill on every op**, right after `upsertPerson` (`:189`): if an entry
   exists with `register_no = ''` and `caller.regNo` is non-empty, call
   `backfillRegisterNo`. Covers all rows written before this deploy without
   waiting for a re-publish.
3. `buildState` (`:126-165`): no structural change — `computeMatches` now
   returns `regNo` inside `overlaps` (§4); `sections[].people` unchanged.
4. **OpenAPI** (`:6-56`): document that `publish` accepts only
   `source: "registered"`, the new `planned_sharing_disabled` 400, and that
   overlap entries include `regNo` (reciprocal only).

## 4. Matching (`src/lib/ffcsMatch.ts`)

- `MatchCandidate` (`:137-143`) += `regNo: string`.
- `OverlapMatch` (`:154-160`) += `regNo: string`;
  `computeMatches` (`:188`) copies it into the overlap push.
- **`MatchPerson` (`:146`) and `SectionMatch` unchanged** — reg no never
  appears in section rosters (decision D3).
- `validatePlan` stays, with a comment: _planned publishing is disabled at the
  route; these rules remain the spec of a valid plan._ `MatchSource` unchanged
  (see D1 rationale for keeping the CHECK too).
- Caps (`MAX_PLAN_CLASSES` … `MAX_OVERLAPS`) unchanged.

## 5. Tests (backend — named, required)

- `src/lib/ffcsMatch.test.ts`
  - `computeMatches`: reg no propagates candidates → overlaps (`:126`,
    `:142-174` region); **asserting it does NOT appear in
    `sections[].people`**.
  - `validatePlan` tests stay green (function untouched).
- `src/lib/ffcsMatchDb.test.ts`
  - All **11 `publishEntry` call sites** (`:45-101`) get the new `regNo`
    argument.
  - New: `register_no` round-trips through publish; `backfillRegisterNo` fills
    blanks and leaves `changes_in_window` alone; the planned-row `DELETE`
    removes only `source = 'planned'` rows.
- No `route.test.ts` exists in this repo (VTOP mocking) — the planned-reject
  path gets a **manual verification note** instead (03-build-phases, Phase 3).

## 6. Privacy-invariant comment/doc updates (same change, not follow-up)

| Where                                 | Says today                                              | Becomes                                                                                   |
| ------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `ffcsMatchDb.ts:10-11`                | "no plaintext registration number is stored here"       | …except `register_no`, shown only to reciprocal overlap sharers (decision D3)             |
| `socialDb.ts:13-14`                   | "no plaintext reg no in any table this feature creates" | qualify: the friend finder's `ffcs_match_entries.register_no` is the documented exception |
| `ffcsMatch.ts:145`                    | "nothing that identifies them beyond the name"          | name + reg no **in overlaps only**; section people stay name/handle                       |
| `docs/ffcs-friend-finder/index.md:48` | "No reg no, no owner key, no other classes"             | reg no shared with people who share ≥2 classes (reciprocal); never in section rosters     |

## 7. Deploy notes

- No new environment variables. `FFCS_REPORT_BASE_URL` still overridable.
- DDL (`ALTER`), cleanup (`DELETE`), and backfill run on first request per
  instance (`schemaReady`).
- Rate limit (`30/60s/IP`), daily change cap (`10`), `MAX_CANDIDATES 3000`,
  GIN index: all unchanged.
- **Ship after the app stops sending `source: "planned"`** — stragglers (old
  cached clients) receive a handled 400 with friendly copy
  (`planned_sharing_disabled` message added client-side in 02 §1).
