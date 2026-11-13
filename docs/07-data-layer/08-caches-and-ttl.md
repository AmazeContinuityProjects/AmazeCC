---
title: "Caches & Their TTLs"
description: "every cache_* key has exactly one owner and one refresh trigger — this is the table. If a key isn't here, it's not a cache, it's state (see 04-atoms-catalog.md)."
---

# 08 — Caches & Their TTLs

> **In one line:** every `cache_*` key has exactly one owner and one refresh trigger — this is
> the table. If a key isn't here, it's not a cache, it's state (see 04-atoms-catalog.md).

| Key                                            | Owner (refresh trigger)                       | TTL                  | Fallback if missing                  |
| ---------------------------------------------- | --------------------------------------------- | -------------------- | ------------------------------------ |
| `cache_whoami`                                 | `whoami` op (per sync/login)                  | session-ish (10 min) | hides whoami cards                   |
| `cache_registration_schedule`                  | `bulk`/`ffcs section=registration` (per sync) | session              | Registration card shows "not loaded" |
| `cache_ffcs_feedback`                          | any `ffcs` sync (manual/full/core)            | session              | feedback badge hidden                |
| `cache_buses`                                  | Worker CDN fetch, first paint                 | hours                | last value forever                   |
| `cache_mess_*` / `cache_laundry_*`             | Worker fetch per tab entry                    | few hours            | stale with label                     |
| `cache_payments`                               | payments tab every open                       | immediate            | —                                    |
| `cache_curriculum`                             | `curriculum` op (boot if absent)              | semester             | FFCS curriculum filter unavailable   |
| `cache_registration-schedule` (dash)           | registration receipt                          | manual refresh       | ProfileStatusCards "Action required" |
| `cache_acknowledgement` / `cache_ept_schedule` | `whoami` bundle                               | semester             | hides ack cards                      |
| `cache_library_due`                            | Libraries tab                                 | 10 min               | Dues blank                           |
| `frozen_marks_<sem>`                           | marks sync engine                             | **never**            | cohort contribution absent           |
| `frozen_grade_*`                               | grades adapter                                | **never**            | legacy reconciliation absent         |
| `github_changelog_cache`                       | changelog modal on open                       | 6h                   | previous build note                  |
| `uni_cc_generic_*`                             | UniCC-era passthrough                         | none                 | legacy keys not written anymore      |

## The one informal rule

**Nothing renders an empty list when it could render a labeled stale one.** If a cache exists,
prefer it over networkless silence — with the freshness label.

## Cache eviction discipline

- No explicit eviction anywhere — caches overflow by failing on the future write and by
  semester wipe semantics coming from settings changes (`currSemesterID`).
- If you add one: document the TTL here _and_ in the feature page.
