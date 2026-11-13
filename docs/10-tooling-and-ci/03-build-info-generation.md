---
title: "Build-Info Generation (buildInfo.json)"
description: 'every build stamps {sha, date, subjects, buildNumber} into a committed JSON that UI reads for "version" surfaces.'
---

# Build-Info Generation (`buildInfo.json`)

> **In one line:** every build stamps `{sha, date, subjects, buildNumber}` into a committed JSON that UI reads for "version" surfaces.

## How it runs

`predev`, `prebuild`, `pretest`, `pretypecheck` — all shell to `scripts/generate-build-info.js`,
which reads `git rev-parse` for sha, `git log -5 --format=%s` for subjects, sets `buildNumber`
to `git rev-list --count HEAD`. Failure → writes placeholders, warns, continues (CI survives
a missing .git).

## Where it's read

`src/data/buildInfo.json` — imported by the About/Changelog section + ProfilePage diagnostics

- ErrorDiagnosticCard (embedded in bug reports so a stack links to its exact commit).

## Why committed

Generated pre-build; regenerated on CI with same content for unchanged trees → deterministic
for agents diffing trees.
