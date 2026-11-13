---
title: "Handoff Checklist (what you now own)"
description: "a named surface → its source area → its tests → its docs — tick them off as you get comfortable."
---

# Handoff Checklist (what you now own)

> **In one line:** a named surface → its source area → its tests → its docs — tick them off as
> you get comfortable.
> **Audience:** the developer inheriting AmazeCC. **Reading time:** ~10 min.

## The map of ownership

| Area                              | Source                                                          | Docs                                   | Tests (examples)                                     |
| --------------------------------- | --------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------- |
| App shell (Main, nav, sync sheet) | `components/custom/Main.tsx`, `components/custom/app/*`         | `04-app-shell/`                        | `sync-modes.test.ts`, `sync-session.test.ts`         |
| Sync engine                       | `lib/sync-engine/*`                                             | `06-sync-engine/`                      | `sync-engine-autologin.test.ts`, `marksSync.test.ts` |
| Academics (marks/grades/calendar) | `lib/calendarDay.ts`, `marksPredictor.ts`, `gradeBoundaries.ts` | `05-academics/`, `05-marks-predictor/` | `calendarDay.test.ts`, `gradeBoundaries.test.ts`     |
| Attendance                        | `lib/attendancePredictor.ts`, `attendance/`                     | `05-attendance/`                       | `attendance*` suites                                 |
| FFCS planner                      | `exams/FFCSTimetableTab.tsx`, `FFCS/`, `lib/ffcs*`              | `05-ffcs-planner/`                     | 37 `ffcs*` suites                                    |
| Tasks/Pomodoro                    | `components/custom/tasks/`                                      | `05-tasks-and-pomodoro/`               | `tasks*` suites                                      |
| Social/pairing                    | `lib/social/`, `social/`                                        | `05-social/`                           | 15 `social*` suites                                  |
| Friend Finder                     | `friendfinder/`, `ffcsClassmates.ts`                            | `05-friend-finder/`                    | `ffcsClassmates.test.ts`                             |
| PWA/SW                            | `app/sw.ts`, `ServiceWorkerRegistrar`                           | `08-pwa-platform/`                     | `chunkRecovery.test.ts`                              |
| Scanner                           | `lib/scanner/`                                                  | `05-paper-scanner/`                    | 10 scanner suites                                    |
| Data/vault                        | `storage.ts`, `credentialVault.ts`                              | `07-data-layer/`, `11-security/`       | `credential-manager.test.ts`                         |

## Your first 30 days

- [ ] Run demo mode; click every tab; read `13-troubleshooting/07-faq.md` when lost
- [ ] Run the full test suite; read 5 suites you didn't write
- [ ] Fix one small thing (a typo, a padding) end-to-end: branch → PR → green CI
- [ ] Read `99-reference/decisions/` ADRs — they explain _why the app is weird_
- [ ] Ask about `docs/archive/` before believing anything inside it
- [ ] Own one alerting/monitoring surface (PostHog) by week 3
- [ ] Shadow one release (`08-building-for-production.md`) end-to-end

## The honest state of the code (what you inherit)

- No URL routing inside the signed-in app (by design, see ADR-0001)
- `strictNullChecks: false` (see ADR-0003's sibling notes)
- Two near-identical tour systems (FFCS + marks predictor) — dedupe is welcome, carefully
- Several legacy feature folders flagged in `99-reference/` notes
- `StatCards.tsx` is dead; a few alias components exist for re-export ergonomics

None of these are emergencies. All of them are documented where they live.
