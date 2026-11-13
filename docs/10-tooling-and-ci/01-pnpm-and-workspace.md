---
title: "pnpm & the Workspace"
description: "pnpm 10, strict peers, content-addressed store; don't let npm touch this repo."
---

# 01 — pnpm & the Workspace

> **In one line:** pnpm 10, strict peers, content-addressed store; don't let npm touch this repo.

- `pnpm-lock.yaml` is the contract — `--frozen-lockfile` in CI proves it
- `.npmrc`: `package-manager=pnpm`, `auto-install-peers=true`, `strict-peer-dependencies=true`
- `pnpm-workspace.yaml` — single-package workspace; exists for metadata scripts
- Why not npm/yarn: phantom dependencies (anything importable must be declared) + disk economy + install determinism
