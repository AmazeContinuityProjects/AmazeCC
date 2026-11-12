# Marks & Cohort Statistics — Architecture (deep)

> **In one line:** opt-in contribution → one-way SHA-256 assessment keys → server pools →
> HMAC receipts return → client freezes them forever — drift is surfaced, not merged.

## 1. The four layers

```
Layer 1 (capture)  — settings → "contribute to class statistics" (default OFF)
Layer 2 (key)      — sha256(`${classId}::${component}::${title-normalized}`)
Layer 3 (transmit) — flat payload per affected row (no identity fields at all); POST marksStats
Layer 4 (receipts) — server returns HMAC-signed accepted receipts; client freezes them
```

## 2. Why no name/registration number on the wire (and what ships instead)

A cohort stat is meaningful without knowing who contributed. The "openSecret" assessmentKey method:
`normalizeTitle(component)` lowercases + strips punctuation → hash matches server's identical normalization.
Anyone with the key cannot reverse it to a contributor — only the server knows class-to-person mapping
(only for its own caching; it never publishes it).

## 3. Frozen receipts (`marksFrozenV1`)

Every accepted write gets an HMAC receipt `{ key, n, ts }`. Client compares:

```
current_receipts ⊇ frozen_receipts   → healthy, no drift
current_receipts ⊄ frozen_receipts   → VTOP/server re-ingested ("paper re-uploaded"); log warning, never silently re-send
```

`frozen_marks_<semesterId>` keeps per-term anchors — that's how we can see _which semester_
got disturbed if a paper changes post-hoc.

## 4. The merge you see in the UI

`GradesModal` / class statistics: μ, σ, `topFraction` per class — local storage preference
underlies; server lies = drift log lines. The UI encourages 2 syncs/day during FAT.

## 5. What can go wrong (and what does happen)

- **Empty cohort** → silence — expected; fewer than ~8 receipts → "insufficient data"
- **Key mismatch** → contribution accepted but never appears — receipt mismatch handled by backfill v2
- **Server 5xx** → nothing leaks; local state undisturbed; log in sheet
- **Debug logging** — `MARKS_SYNC_DUMP=1` (dev env) enables the one-shot dump of payload+response for support sessions
