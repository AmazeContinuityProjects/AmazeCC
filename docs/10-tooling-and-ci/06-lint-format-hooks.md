# 06 — Lint, Format & Pre-Commit Hooks

> **In one line:** ESLint flat config finds real problems; Prettier keeps diffs sane; husky enforces both pre-commit.

- `eslint.config.mjs` — `@next/eslint-plugin-next`? (not actually — this repo uses flat config hand-rolled: typescript-eslint, react, react-hooks, jsx-a11y — verify at HEAD)
- `no-explicit-any` → **warn** not error (deliberate per strictness tiers; see 07)
- `.prettierrc`: double quotes off? (repo standard: double quotes, semicolons, trailing commas) — keep consistent; `lint-staged` reformats on commit
- `.husky/pre-commit` runs lint-staged on staged files only
- If Prettier reformats your file on commit, accept it — don't fight the tool
