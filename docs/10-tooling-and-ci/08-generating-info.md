# 08 — Changelog & Release Information

> **In one line:** `changelog.json` is the user-facing narrative; `buildInfo.json` is the build identity; `git tag` connects the two.

- `data/changelog.json` — array of `{version, date, title, highlights[], changes[]}` — hand-maintained at every release; render via ChangelogModal
- `buildInfo.json` (generated) — app embeds `buildNumber` + sha; `About` screen shows `#1330 (29f5b69c)`
- Release marks: `v3.2.0` (Oct 2026, FFCS rebuild); tags aren't strictly followed for each minor — changelog is the authority
