# Data Model

## 1. Tables

All three are created by the route that first needs them, inline, following the `CREATE TABLE IF NOT EXISTS` convention already used by `marks/sync/route.ts` and `cabshare/auth/route.ts`. There is no migrations directory in this repo and no `db:push` script, so inline DDL is the house style — and it does mean the schema only exists in production if a route has actually been hit.

```sql
-- One row per person, created on first successful derivation.
CREATE TABLE IF NOT EXISTS social_people (
  owner_key     TEXT PRIMARY KEY,          -- maskUserID(registerNo); internal, never returned
  handle        TEXT UNIQUE NOT NULL,      -- public, e.g. 'AMZ-4F7K-2Q9X'
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (person, semester). version increments on every publish.
CREATE TABLE IF NOT EXISTS social_timetables (
  owner_key         TEXT NOT NULL,
  semester_id       TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  busy_map          JSONB NOT NULL DEFAULT '{}'::jsonb,
  courses           JSONB NOT NULL DEFAULT '[]'::jsonb,
  slotmap_version   TEXT NOT NULL,
  published_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_updated_at TIMESTAMPTZ,
  PRIMARY KEY (owner_key, semester_id)
);

-- The shared signed key. One row per pair, enforced structurally.
CREATE TABLE IF NOT EXISTS social_grants (
  grant_id    TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  owner_a     TEXT NOT NULL,               -- always least(owner_a, owner_b)
  owner_b     TEXT NOT NULL,               -- always greatest(owner_a, owner_b)
  created_by  TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'coarse' CHECK (visibility IN ('coarse', 'full')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  UNIQUE (owner_a, owner_b)
);

CREATE INDEX IF NOT EXISTS idx_social_grants_a ON social_grants (owner_a);
CREATE INDEX IF NOT EXISTS idx_social_grants_b ON social_grants (owner_b);
CREATE INDEX IF NOT EXISTS idx_social_grants_hash ON social_grants (secret_hash);
```

The campus-wide current semester lives in the existing key/value table, `app_config`, so no fourth table is needed:

```sql
-- Reuses the store already read by /api/settings/global/route.ts
-- key = 'social_current_semester', value = { semesterId, label, resolvedAt }
```

## 2. `least()` / `greatest()` is the mutual-pairing invariant

Storing the participants in sorted order with a `UNIQUE` constraint over the pair means:

- **Exactly one grant can ever exist between two people.** No insert race can create a second.
- **Direction is implicit.** There is no `follower`/`following` column, so there is no way to express a one-way relationship, and therefore no way to accidentally create one.
- **Revocation is one row.** `revoked_at` severs both directions simultaneously, because both directions were the same row to begin with.

`created_by` is kept even though it is not needed for authorisation — it is the audit trail for "who initiated this", which matters for abuse reports.

## 3. `busy_map`

The canonical representation. An object keyed by `"DAY:SLOTID"`, where `DAY` is one of `MON TUE WED THU FRI SAT SUN` and `SLOTID` is a slot id from `config.json`.

```jsonc
{
  "MON:A1":  { "c": "CSSE1001", "t": "Computer Programming", "v": "AB1-101" },
  "MON:L1":  { "c": "CSSE1001L", "t": "Computer Programming Lab", "v": "LAB3-2" },
  "WED:A1":  { "c": "CSSE1001", "t": "Computer Programming", "v": "AB1-101" },
  "TUE:TB1": { "c": "MA1101", "t": "Mathematics I", "v": "" }
}
```

| Field | Key | Meaning | Present in coarse? |
|---|---|---|---|
| `c` | course code | | no |
| `t` | course title | | no |
| `v` | venue | | no |

Coarse mode is the same object with all three fields stripped, leaving the keys and nothing else. That is enough for "free right now" and "common free slots" — the two features that actually drive the tab — while removing course and venue disclosure entirely.

**Maximum 164 entries**, one per slot in the vocabulary. A payload above that is rejected, not truncated: a truncated busy map would silently mark a student free during a class.

Keys are validated at ingest against the server's own copy of the slot vocabulary. An unknown `"DAY:SLOTID"` fails the whole publish with `unknown_slot`, because a partial accept would produce a timetable that looks complete and is not.

## 4. `courses`

A small display-only array, deduplicated by course code, so the detail view can render a course header without a lookup per slot:

```ts
export type SocialCourse = {
  code: string;       // "BACSE102" — real, from the "Course" cell
  title: string;      // "Problem Solving Using Java"
  venue: string;      // "AB1-607B"
  ltpjc: string;      // "0 0 4 0 2.0" — raw from the "L T P J C" column
  category: string;   // "Lab Only" | "Embedded Theory" | "Embedded Lab" — the
                      // authoritative theory/lab discriminator
  classId: string;    // "CH2026270102069" — embeds the semester code
  faculty: string;
};
```

`ltpjc`, `category` and `classId` are the "course allocation" half of the derivation. They are stored so a future consumer can build a proper weekly grid without another VTOP scrape.

`category` is worth calling out. The existing parser infers theory-vs-lab from whether a *slot id* starts with `L` (`fetchTimeTable.ts`), which misclassifies `F1+TF1` — a theory-plus-tutorial slot belonging to an **Embedded Theory** course. The `Category` column states it directly, and it is already parsed correctly at `cells[4]`.

`classId` embeds the semester code (`CH20262701` + `02069`), which the derivation uses as a post-fetch self-check: if the returned ids do not start with the resolved `semesterId`, the semester was wrong and the record is discarded.

## 5. `slotmap_version`

The vocabulary is versioned because `config.json` is a file that changes independently of the database, and the current share-code format fails precisely because it is unversioned (see [09-schedule-math.md](./09-schedule-math.md) §5).

- The client sends a version string with every publish.
- The server stores it and **validates the keys against its own vocabulary**; the version string is for diagnostics and future migrations, not for trust.
- If a `slotMap` change ever renames or removes a slot, existing rows are migrated by a one-off script that maps old keys to new ones and stamps a new version. The probe and the vocabulary assertions in that doc make such a change detectable rather than silent.

Computed as a short hash of the vocabulary itself rather than a hand-maintained integer, so it cannot drift from the data:

```ts
// client and server compute this identically
const slotmapVersion = hashOf(
  DAYS.flatMap(d => Object.keys(slotMap[d]).sort().map(s => `${d}:${s}`))
);
```

## 6. TypeScript types

Shared shape, mirrored on both sides. The frontend copy lives in `src/lib/social/types.ts`; the server's in `AmazeCC-API/src/lib/socialTypes.ts`.

```ts
export type SocialVisibility = "coarse" | "full";

export type BusyEntry = { c?: string; t?: string; v?: string };

export type BusyMap = Record<string, BusyEntry>;   // "MON:A1" → entry

export interface SocialIdentity {
  ownerKey: string;        // cached for display/short-circuit only
  handle: string;          // "AMZ-4F7K-2Q9X"
  displayName: string;
  semesterId: string;
  semesterLabel: string;
  derivedAt: string;       // ISO
  slotmapVersion: string;
}

export interface SocialTimetable {
  ownerKey: string;
  semesterId: string;
  semesterLabel: string;
  version: number;
  busyMap: BusyMap;
  courses: SocialCourse[];
  publishedAt: string;     // ISO — drives the staleness badge
  slotmapVersion: string;
}

export interface SocialGrant {
  grantId: string;
  secret: string;          // plaintext; only ever stored client-side
  peerHandle: string;
  peerName: string;
  visibility: SocialVisibility;
  createdAt: string;
  semesters: string[];     // semesters both sides have published
}

export interface SocialPeer {
  handle: string;
  name: string;
  visibility: SocialVisibility;
  shared: boolean;         // a grant exists
  lastPublishedAt: string | null;
  semesterId: string | null;
  isSelf: boolean;
}
```

## 7. Limits

Enforced on ingest, with the same array-length guard style as `marks/sync/route.ts:49-52`.

| Limit | Value | On breach |
|---|---|---|
| `busy_map` entries | 164 | `400 invalid_busy_map` |
| `courses` length | 60 | `400 too_many_courses` |
| Any single string field | 200 chars | `400 field_too_long` |
| Grants per person | 200 | `409 grant_limit_reached` |
| Publishes per person per hour | 120 | `429` |
| Pair claims per person per hour | 30 | `429` |

The course limit is 60 rather than 164 because `config.json` has 164 *slots* but a student never enrols in more than a dozen courses; the ceiling is generous and exists only to bound the payload.

## 8. What this replaces

The old `Friend.classSlots[]` is an array with one entry per `(day, slotId)` — the same information, expanded, with no semester, no version and no provenance. It is migrated to `legacy` in [12-migration-plan.md](./12-migration-plan.md) and read-only. It is not converted, because its slot set cannot be attributed to a semester and a wrong guess would render as authoritative.
