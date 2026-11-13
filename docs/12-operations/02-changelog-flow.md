---
title: "Changelog Flow"
description: "changelog.json is written by humans at release time; everything else derives from git."
---

# 02 — Changelog Flow

> **In one line:** changelog.json is written by humans at release time; everything else derives from git.

- Release walkthrough: bump changelog.json → confirm → merge → auto-deploy → verify deploy
- Hotfix: commit directly (repo is small PRs by maintainers), tag afterwards — changelog.json amended in a release PR
- The About screen literally renders changelog.json; stale entries = stale marketing
