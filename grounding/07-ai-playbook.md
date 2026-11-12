# 07 — AI Execution Playbook

How an AI agent actually does this work without drifting, hallucinating, or exhausting context.

## Session setup (every WP agent)

1. Read `00-README.md` → `01-inventory.md` → your WP in `05-work-packages.md` → the writing
   standard (`04-writing-standard.md`) → `06-verification.md` V-checks relevant to you.
2. Skim the repo's `AGENTS.md` (root) — this Next.js version is NOT your training data;
   `node_modules/next/dist/docs/` is the authority for anything Next-specific.
3. Verify your inventory slice with git/rg before writing (counts drift).
4. Plan the file list for the session; write skeletons first (all `# Title` + In one line),
   then fill bodies. Commit skeletons separately if you run out of context — a skeleton PR is
   better than a half-page.

## Per-file workflow (mandatory loop)

```
for each doc file in your WP:
  1. Identify the source(s) of truth in src/ (path + line range). Open them. Read them.
  2. Write the file starting from the 04 template's "In one line" header.
  3. Paste at least one real excerpt with path:line attribution.
  4. Cross-check every claim you typed against the file you read. Re-read your own page as a
     stranger: would you believe it?
  5. Add/update glossary entries for every new term.
  6. Add the page to its folder's README + docs/README.md if top-level.
  7. Run link check for the file you just wrote.
```

## Context management

- One WP ≈ one focused session (XL WPs may split per feature folder).
- Do not hold the whole codebase in mind; hold _your folders'_ sources. `01-inventory.md` is
  your map; `09-coverage-checklist.md` is your scoreboard.
- If you hit a file you don't understand (e.g. `ffcsGenerate.ts`), read the test suite for it
  first (tests state intent better than code comments).
- For >4k-line files, read in 400–600 line windows and annotate by line range in your notes;
  never dump whole files into the conversation.

## What NOT to do

- Don't edit source. If docs and code disagree beyond a typo, write the doc to match the code
  and flag the discrepancy in the commit body (`docs(discrep): …`) for humans to triage.
- Don't "improve" wording from archive/ files you move — only banner them.
- Don't paraphrase `.env.example` into new names — copy semantics verbatim.
- Don't write docs for AmazeCC-API internals beyond the boundary contract; link instead.
- Don't create a file that duplicates an existing one in a different section — merge or
  cross-link instead; duplication rots.

## Commit & delivery cadence

- Commits: `docs: <section> — <page>` per file (or tiny file sets). Push each commit.
- PR template note: "Docs-only PR for WP-nn. Verification run: <paste V-output>. TODO list: …"
- Keep a `docs/.author-notes.md` out of git (or `.gitignore`d) if you need scratch space —
  do not commit scratch.

## Failure protocols

| Situation                                    | Response                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Source contradicts itself (two impls)        | Document both, label which is live, file marker in commit message                                             |
| Tool refuses a URL/asset (no network)        | Say so; never invent API responses; describe shape from types only                                            |
| Asked to document something you can't verify | `<!-- TODO(docs): verify ⟨X⟩ — needs a live VTOP session / the prod bundle -->` + list in WP report; continue |
| Merge conflicts between WP agents            | Prefer the file in this repo's HEAD; fold in newer fact; note it                                              |
| Context exhausted mid-WP                     | Commit skeletons + this session's notes; finish next session                                                  |

## Quality bar self-test (ask of every page)

1. Can a stranger state the feature's purpose after one paragraph?
2. Is every acronym defined (here or glossary)?
3. Are all referenced paths real?
4. Does the page name the tests?
5. Do the "sharp edges" match code comments (HACK/DANGER/do-not)?
6. Would deleting this file lose information that exists nowhere else? If yes, add the
   information somewhere else instead (dedupe).

## Reporting at WP end

Your final message must include: files created, verification output, open TODOs, any source/docs
contradictions found, and the next WP unlocked. No "done" without those five.
