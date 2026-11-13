---
title: "storage.ts Typed Catalog"
description: "every named accessor, what it reads/writes, and who uses it — kept here so the file never grows a mystery accessor again."
---

# 02 — `storage.ts` Typed Catalog

> **In one line:** every named accessor, what it reads/writes, and who uses it — kept here so
> the file never grows a mystery accessor again.

`src/lib/storage.ts` — central KEYS + typed `storage.<domain>.{get,set}`:

| accessor                                                | backing key(s)                               | payload                                    | consumers                             |
| ------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| `storage.attendance` / `marks` / `grades` / `allGrades` | `attendance`, `marks`, `grades`, `allGrades` | raw API payloads                           | engine state-bridge, boot rehydration |
| `storage.schedule`                                      | `schedule`                                   | exam schedule                              | ScheduleDisplay, .ics                 |
| `storage.hostel` / `calendar` / `moodle`                | `hostel`, `calendar`, `moodle`               | payloads                                   | dashboard atoms                       |
| `storage.ids`                                           | `IDs`                                        | `{VtopUsername,VtopPassword,Moodle*}`      | login flow, vault migrates            |
| `storage.demoMode`                                      | `demoMode`                                   | bool                                       | everywhere                            |
| `storage.vtopSession`                                   | `vtopSession`                                | `{cookies, authorizedID, csrf, fetchedAt}` | credential-manager                    |
| `storage.eventHubSession`                               | `eventHubSession`                            | `{jsessionid,…}`                           | EventHub/ClubHub flows                |
| `storage.curriculum`                                    | `curriculum`                                 | VIT curriculum catalog                     | grade predictor pre-filter            |
| `storage.officialOd*`                                   | `officialOD_*`                               | per-semester OD records                    | OD tracker                            |
| `storage.registrationSchedule`                          | `registration_schedule`                      | registration receipt                       | ProfileStatusCards                    |
| `storage.profile`                                       | `profile`                                    | `{name, regNumber, branch, isHosteller}`   | ProfilePage                           |

Full raw key list: 03-local-storage-key-catalog.md.

## The merge-on-read note

`settingsAtom` (07-settings-atom.md) overlaps this file — settings are the one cache with a
migration shim, not a raw pass-through. Everything else in storage is all-or-nothing: corrupt →
falls back to empty, never to half-mixed.
