# AmazeCC Documentation Handbook — Read This First

> **Audience of this folder:** an AI agent (or human) about to write, rewrite, or audit the
> documentation for the **AmazeCC** frontend repository. Read every file in this folder
> **before writing a single line of `docs/`**. These files ARE the specification.
>
> If you are a fresh AI session: your job is **documentation only**. You do **not** modify
> source code, tests, config, or `docs/` content outside the files assigned to your
> work package (WP). See `07-ai-playbook.md`.

## What we are doing

AmazeCC is a large, undocumented-in-many-places Next.js 16 **static-export** PWA that
replaces VIT University's official "VTOP" portal. It is being **handed off** to new
developers — possibly junior developers who do not yet know what React, Next.js, a
service worker, or a static export **is**. The owner has explicitly said:

- The docs must be **human-readable and spoonfeeding**: assume the reader is an amateur
  web dev and teach the web itself as you go.
- The docs must cover **every segment of the app, every routing decision** — nothing is
  too small.
- **Size does not matter.** If the `docs/` folder becomes larger than the codebase,
  that is acceptable and expected. A docs tree of 300–1,000 files is the goal.
- The docs you generate will be the **onboarding contract** for the handoff.

## How to read this folder (in order)

| File                          | What it contains                                                                                      | When to read                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `00-README.md`                | This file — mission, ground rules, file map                                                           | First                              |
| `01-inventory.md`             | A measured snapshot of the codebase (sizes, hot spots, dead code, duplicates)                         | Before writing anything            |
| `02-existing-docs-triage.md`  | What happens to the current `docs/` (rewrite / keep / archive)                                        | Before deleting or moving anything |
| `03-target-docs-structure.md` | The full target tree for the revamped `docs/` — file by file                                          | Before creating your first doc     |
| `04-writing-standard.md`      | The spoonfeeding style guide: tone, structure, glossary, page template                                | Before writing any doc page        |
| `05-work-packages.md`         | The execution plan, WP-00 through WP-N, in dependency order                                           | When planning your session(s)      |
| `06-verification.md`          | How to check the docs are complete, accurate, and linked — the Definition of Done                     | Before declaring any WP done       |
| `07-ai-playbook.md`           | How an AI agent executes this: context management, per-file workflow, pitfalls                        | When starting work                 |
| `08-glossary-seed.md`         | Starter glossary (~150 terms) — every doc must link here, and must extend it                          | First writing session              |
| `09-coverage-checklist.md`    | **The exhaustive per-file checklist**: every source file, route, test, script and doc that must exist | The definition of "done"           |

## Ground rules — non-negotiable

1. **Docs-only.** No source, test, config, or build changes. Exception: fixing a broken
   link inside `docs/` itself is allowed; renaming code ("this badly-named component") is
   NOT — document what exists, not what you'd rename it to.
2. **Verified, not remembered.** Every claim in a doc must be traceable to code you actually
   read in this repo (`src/…`), to `node_modules/next/dist/docs/` for Next.js behavior, or to
   an official doc you fetched. Never write "I believe" / "probably" about code behavior.
3. **Stale = wrong.** The current `docs/` describes a _different architecture_ (a full-stack
   app with `src/app/api/*` and HMAC tokens). That is **not** this repo anymore — this is a
   static export with no API routes. If existing text contradicts the code, the code wins and
   the text is rewritten or archived per `02-existing-docs-triage.md`.
4. **Spoonfeed.** Every page must be readable by someone who has used but never built a web
   app. See `04-writing-standard.md`. When in doubt, explain more, not less.
5. **No secrets.** Never paste `.env` values, coordinates, tokens, or VTOP credentials into
   docs. `.env` is gitignored; document _variable names and meanings_ only. The PostHog
   project token (`phc_obkUK…`) is public-by-design and safe to reference _as a public token_,
   but do not treat it as something to copy into new places without need.
6. **Handoff tone.** Write to "you" (the new dev). Welcome tone, no jargon without a
   definition, no cleverness at the expense of clarity.
7. **Every doc is indexed.** Every file created under `docs/` must be linked from the new
   `docs/README.md` (or the index of its section). Orphan pages fail review.
8. **Keep links relative** and never link to `../AmazeCC-API/…` (that is a _separate repo_;
   reference it by name, e.g. "the AmazeCC-API repo, `src/app/api/ffcs/route.ts`").
9. **Commit hygiene.** Deliver docs in small, coherent commits scoped to one work package.
   Never bundle code changes (there should be none).
10. **If you get stuck, do not improvise silently.** Leave a
    `<!-- TODO(docs): <question> -->` marker at the spot, list it in your commit message, and
    keep going — do not fabricate. A marked gap is better than an invented fact.

## The 20,000-foot state of the codebase (as of 2026-11, verify when working)

- **Stack:** Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS v4, jotai 2,
  Framer Motion, Serwist (service worker), PostHog (analytics + error tracking), Vitest.
- **Shape:** static export (`output: "export"` in `next.config.mjs`) — the app is plain
  HTML/CSS/JS hosted on GitHub Pages; there is **no server, no `app/api/*`** inside this repo.
- **The one page:** everything the student sees in the signed-in app mounts under
  `src/app/page.tsx` → `Main.tsx` → `NavTabs/Dashboard` (a client-side "tab" system driven by
  jotai atoms, NOT URL routes). A handful of standalone URL routes exist (`/ffcs`,
  `/friend-finder`, `/share/ffcs`, `/share`, `/privacy`, `/terms`, `/~offline`).
- **Backend:** a separate repo, `AmazeCC-API` (api.amazecc.com), which scrapes VTOP and serves
  this app its data. This repo is blind: no file here can change VTOP's behavior.
- **Scale:** ~721 source files under `src/`, ~184k lines, ~204 test files, ~710 TS/TSX/CSS
  files. Large enough that inventory-first discipline (see `01-inventory.md`) is mandatory.

## Definition of "done" for the whole effort

See `06-verification.md` for the full checklist. In brief: all routes, components, lib
modules, atoms, env vars, tests, scripts, workflows and storage keys are documented and
indexed; every link resolves; `pnpm run test` / `typecheck` / `lint` still pass (docs must not
break them); the coverage checklist in `09-coverage-checklist.md` is 100% checked; and a
brand-new developer with no VIT or Next.js knowledge can follow `docs/` from zero to a running
dev environment and a first meaningful change.
