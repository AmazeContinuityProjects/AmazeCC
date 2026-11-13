# 07 — Typecheck & Strictness Tiers

> **In one line:** TypeScript that doesn't block shipping — `strictNullChecks: false` on purpose, and a staged path toward strict.

## Current posture

- `strictNullChecks: false` — the pain of turning it on wholesale exceeds the bugs it would catch _today_; defensive `?.`/`??` everywhere is the house rule
- `noImplicitAny` — off at the compiler level; ESLint warns instead
- `ignoreBuildErrors: false` — type errors **fail the build**; no "just ship it" path
- `noUnusedLocals/noUnusedParameters` — enforced (errors)

## The tier plan (`docs/archive/todo/typing-issues/`)

Archived notes describe a strictness ladder: quick wins → data models → strict-mode + API hardening.
None of it is scheduled — treat as research notes only.

## What you must do anyway

- New files: treat as strictTemp — enable `strictNullChecks` locally (`// @ts-strict` is not a thing;
  instead: strict at the file level via tsconfig override isn't available) — in practice: write `?.`/`??` voluntarily
- New modules: declare explicit types on exports; `any` in a public signature is review-blocking
