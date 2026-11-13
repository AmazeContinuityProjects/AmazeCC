# 03 — Complete localStorage Key Catalog

> **In one line:** every raw key this app writes anywhere, grouped by owner, with "who writes it" and "who reads it".
> **Method:** `Select-String 'localStorage\.(getItem|setItem|removeItem)\("[^"]+"' src/**/*.{ts,tsx}` + `storage.ts` KEYS + template-literal prefix families. Regenerate on each docs sweep.

## By raw key (direct `localStorage.*` calls — 122 sites)

| Key                                                                     | Writes                                | Reads                                         |
| ----------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `attendance` / `marks` / `grades` / `allGrades`                         | sync-engine state bridge              | entire app                                    |
| `amazecc_custom_api_url` / `amazecc_active_api_url`                     | Settings → Advanced (API host picker) | `fetch-utils.ts` on every request             |
| `course_dashboard_target*` / `.*_tab`                                   | course overview deep links            | CourseDashboard                               |
| `amazecc_feedback_email`                                                | feedback form prefill                 | FeedbackModal                                 |
| `marksSyncBackfillV2` / `marksSyncBackfillV1` / `marksSyncBackfill`-ish | marks-sync one-time backfill flags    | marksSync.ts                                  |
| `profile` / `username` / `password`                                     | vault & boot seed                     | AppHousing hydration                          |
| `settings`                                                              | settings atom (with migration merge)  | everywhere                                    |
| `hostel` / `transportData` / `moodleData`                               | sync engine / moodle sheets           | hostel & transport screens                    |
| `registeredEvents` / `qcmData` / `wallet` / `allgradesdata` (legacy)    | various                               | renders ignore unknown legacy keys            |
| `uni_cc_*` (payments_dues, gpa_goal, wallet, notes_tracker…)            | UniCC-era leftovers                   | nothing reads some — noted in 20-design-notes |
| `cabshare_user` / `social_groups_v1` / `friends_schedules`              | cab-share & social                    | their screens                                 |
| `koha_password` / `koha_card` / `koha_patron_pages`                     | library patron                        | Libraries tab                                 |
| `activityTree` / `saturday_timetable_override` / `notesTracker`         | misc features                         | Respective screens                            |
| `introDone` / `has_selected_interface` / `fresherWelcomeDismissed`      | onboarding                            | onboarding gates                              |
| `payments_dues` / `payments_receipts` / `payments_wallet`               | finance op path                       | Wallet tab                                    |
| `theme`                                                                 | theme toggle + amazeui                | ThemeProvider                                 |
| `vtop_session` etc.                                                     | credential-manager                    | login flow                                    |

## Template-literal families (never grep-clean)

| Pattern                           | Meaning                                            |
| --------------------------------- | -------------------------------------------------- |
| `frozen_marks_<semesterId>`       | permanent per-term marks anchors                   |
| `officialOD_*`                    | OD ledger per semester                             |
| `cache_<endpoint>`                | API answer caches; TTL owned by feature            |
| `amaze_friend_finder_cache_<sem>` | friend finder results                              |
| `uni_cc_generic_<type>:<json>`    | generic UniCC-era cache (legacy)                   |
| `amazecc_support_tickets`         | feedback tickets history                           |
| `ффffs_*` / `course_dashboard_*`  | typo eras — kept intentionally for backward compat |

## Cache policy families (the only legit "who owns TTLs" answer)

- `cache_*` — feature-owned TTL (refresh on tab entry or explicit sync; otherwise stale-presented-with-label)
- `frozen_*` — never TTL'd; invalidated only by receipts mismatch
- `amazecc_*` — permanent until user action
- `ffcs_*` — planner persistence — see 05-ffcs-planner/storage-and-state.md

## Removing a key safely

1. grep every reader (`getItem("KEY")` + template families)
2. codemod the readers/writers
3. bump a migration note in `settingsAtoms.ts` pattern if it was settings-shaped
4. storage-inspector (footer → LocalStorageSubpage) to verify absence on fresh boot
