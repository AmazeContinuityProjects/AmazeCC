---
title: "Settings & Profile — Architecture (deep)"
description: "~70 settings fields migrated forward per release — settingsAtom is the single mutable store; every screen reads its slice; no field deletes."
---

# Settings & Profile — Architecture (deep)

> **In one line:** ~70 settings fields migrated forward per release — settingsAtom is the single mutable store; every screen reads its slice; no field deletes.

## 1. The migration-on-read dance

Old clients opening new app versions get new fields merged in at read; new keys default sensibly.
This is why settings is an object, not booleans.

## 2. ProfilePage (~2,700 lines) — the sections

| Section    | What it owns                                         |
| ---------- | ---------------------------------------------------- |
| account    | name, photo (show/hide), forget credentials, logout  |
| sync       | modes, sync history, trigger-now                     |
| appearance | theme, palette, font, density                        |
| academic   | semester picker (experimental — logs out full state) |
| privacy    | mode toggle, photo blur, data export                 |
| advanced   | API host picker, custom URLs (power features)        |
| about      | changelog, team, licenses, credits                   |

## 3. Forget credentials

Deletes vault + localStorage creds; does not purge academic data (by explicit design — you may want
your attendance next time you sign in); banners explain it.

## 4. Saving semantics

Every change writes immediately (no Save button); destructive actions require confirmation sheets — never snackbars.
