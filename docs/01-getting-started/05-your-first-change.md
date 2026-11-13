---
title: "Your First Change"
description: "edit one string on the guest hero, see it instantly, commit it."
---

# 05 — Your First Change

> **In one line:** edit one string on the guest hero, see it instantly, commit it.
> **Reading time:** ~6 min.

## Walkthrough

1. Open `src/components/custom/app/GuestExperience.tsx`.
2. Find the hero copy — the heading string a first-time visitor reads.
3. Change a word (keep it honest — e.g. fix a typo rather than rewrite the tagline).
4. Save. The dev server hot-reloads in about a second; the landing reflects your edit.
5. `git status` → one modified file. `git diff` → shows exactly your word change.

## Commit hygiene for this repo

- **Scope the commit message** like `feat(hero): …` / `fix(attendance): …` / `docs: …`.
- **Never commit** `.env*` changes, `public/sw.js` (gitignored), or `src/data/buildInfo.json`
  (regenerated on every build).
- Note from the codebase: `AGENTS.md` says Next.js differs from your training data — the
  repo's docs are in `node_modules/next/dist/docs/`; consult them for any Next feature.
- Prettier runs on commit via husky/lint-staged; if it reformats your file, that's normal.

## Try a second change (recommended)

Edit `docs/00-web-foundation/01-what-a-web-app-is.md` — add a sentence you wish existed when
you started. If it helps the next person, it stays.

## Going live safely

This repo deploys on `main` via GitHub Pages. If you have push access:

```bash
git switch -c your-name/fix-hero-typo
# edit, test, commit
git push -u origin your-name/fix-hero-typo
# open a PR; CI must be green; a maintainer merges → Pages deploys automatically
```

Golden rule: `main` is what students see. If you can't verify it in demo mode or tests,
don't merge it.
