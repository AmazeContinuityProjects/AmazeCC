# 04 — Writing Standard: Spoonfeeding the Amateur

Every page you write is read by a person who has _used_ web apps but never _built_ one —
maybe a first-year CS student inheriting this repo. Your job: make them able to change the
code safely, then able to understand every decision later.

## Voice & posture

- Second person, warm and direct: "you", not "the user" / "the developer" / "we".
- Explain before you instruct. First **what**, then **why**, then **how**. Never lead with code.
- No unexplained abbreviations — ever. First use expands: "Content Security Policy (CSP)".
- No assumed framework knowledge. If a page uses a concept (hook, atom, middleware, cookie),
  it either defines it inline in one sentence or links to its glossary entry AND the primer
  page that teaches it.
- When in doubt, repeat an explanation rather than reference it. Repetition beats a dead link.
- Honest about sharp edges: "This is weird because X; do not touch Y without reading Z."
- Lines ≤ 100 chars where practical; headings sentence case; one H1 per page; H2 sections.
- Australian/neutral English consistent with repo tone ("colour" appears in code; prose
  may use either but be consistent per page).

## Page template (every doc file)

```markdown
# <Title — what this file explains, not acronym-soup>

> **In one line:** <one sentence a newcomer can quote back>
> **Audience:** <who this is for: e.g. "everyone", "people changing attendance sync">
> **Reading time:** ~<N> min · **Prereqs:** <primer pages required, if any>

## Why this exists

<The problem, in user terms. What breaks if you ignore this page?>

## The 5-minute tour

<Narrative walk-through. Screens, clicks, what the student sees.>

## How it works (the machinery)

<Now the internals. Diagram in ASCII/mermaid if it helps. Name real files with real paths.>

## The files, function by function

<Directory-style listing → what each file owns; call out sizes for the monsters
(FFCSGuidedSelector ~5,100 lines) and what that implies.>

## Data shapes

<Types from src/ with paths. Example payloads from code or demoData.json.>

## State, storage, and network

<Which atoms/keys this uses; which requests it makes; cache behaviour.>

## Testing this area

<Exact commands; which suites cover this; what they pin.>

## Failure modes & sharp edges

<Known traps; comments in code that say DANGER/HACK; "do not" list.>

## Related reading

<Links to primer pages, ADRs, archive notes, AmazeCC-API docs by repo path.>
```

Small pages (< 80 lines) may collapse sections, but never drop **Why this exists** or
**Related reading**.

## Diagrams

- Prefer ASCII flow diagrams for build/runtime flow; they survive `grep`.
- Mermaid fenced blocks are allowed (renders on GitHub) for component trees — GitHub Pages
  renders markdown as plain text, so diagrams must be comprehensible raw too.
- Never paste screenshots without alt text; prefer demo-mode walk-throughs described in text.

## Code excerpts

- Excerpt with attribution: `src/lib/marksSync.ts:1-40` (path:line range).
- Never paste secrets, `.env` values, or full 5,000-line files — excerpt the load-bearing
  20–60 lines and link the rest.
- Comment inline for the amateur: `// this runs once ever, not per render` etc.

## Glossary discipline

- `docs/99-reference/glossary.md` is the single glossary. `grounding/08-glossary-seed.md`
  is its starter; grow it as you write.
- Every acronym used anywhere must have a glossary entry: add it in the same commit.
- Format: `**Term (ACRONYM)** — one-sentence plain definition. See also: [page](…).`

## Callouts

Use blockquote admonitions, consistently:

```markdown
> 💡 **Tip:** …
> ⚠️ **Warning:** …
> 🔒 **Privacy:** …
> 🧪 **Testing:** …
> 🕰️ **Historical:** links into docs/archive — not current behaviour.
```

## Naming & links

- Kebab-case filenames; no spaces; no date-only names in the live tree (dates belong in
  archive/).
- Relative links only; anchor pages in the same section; every link must survive a docs-only
  rebuild. Validate with the checker in `06-verification.md`.
- Never link into `node_modules/`, `out/`, or `.next/` — link `src/` or public docs instead.
- `docs/README.md` re-links every top-level section so nothing orphans.

## Handling the "too big" files

`FFCSGuidedSelector.tsx` (~5.1k lines) and `FFCSTimetableTab.tsx` (~4.4k lines) get their own
docs with: component map (by line range), state inventory (useState/useRef count), and
"if you change X, also change Y" invariants. Do not attempt line-by-line commentary; give a
table, then the 10 invariants and the 12 most- edited regions.

## Language conventions to keep consistent

- "sync engine" (not "sync-engine") in prose; `sync-engine/` in paths.
- "demo mode" lowercase when describing behavior.
- "AmazeCC-API" when naming the backend repo; "the API" in prose after first mention.
- "the service worker (SW)" after first expansion.
- British-leaning spellings are fine in docs ("normalise"), but `colour`-style Americanisms in
  new text are OK — consistency per page matters more than nationality.

## What good looks like

A reviewer who has never touched VTOP or this codebase should, after reading any page, be able
to answer: What does this do for the student? Which file(s) implement it? What breaks if I
touch it? How do I test my change? Where do I learn the missing background? If they can't,
the page fails review — say so in the commit message and fix it before moving on.
