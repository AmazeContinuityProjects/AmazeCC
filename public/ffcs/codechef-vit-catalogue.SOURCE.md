# Source & Attribution — CodeChef VIT offline catalogue

The course and faculty data in `codechef-vit-catalogue.csv` is **not** AmazeCC's
own. It was converted from the open data directory of **FFCS-inator**, the FFCS
planner built by **CodeChef VIT**:

- Website: <https://ffcs.codechefvit.com>
- Repository: <https://github.com/CodeChefVIT/ffcs> (local clone used for this
  conversion: `../ffcs`, HEAD `bf9821b` at conversion time)
- License: **MIT © 2025 CodeChef-VIT** — <https://github.com/CodeChefVIT/ffcs/blob/prod/LICENSE>
  We keep their copyright notice intact by crediting them here, in the report
  registry's `attribution` field, and in the converter script's header comment.

Our thanks to the CodeChef VIT team and the student contributors who built and
maintain FFCS-inator and its crowd-sourced course data.

## What was converted

From `ffcs/src/data/`:

| | |
|---|---|
| School folders | 20 (`SCOPE`, `SCOPE_F`, `SCORE`, `SCORE_F`, `SENSE`, `SENSE_F`, `SELECT_F`, `SCE_F`, `SMEC`, `SHINE`, `SHINE_F`, `SBST`, `SBST_F`, `SCHEME`, `SCE`, `SELECT`, `MTech_SCOPE`, `MTech_SCOPE_F`, `MTech_SCORE`, `SMEC_F`) |
| TypeScript files walked | 144 (every `.ts` file under the school folders, including the per-school `index.ts` aggregators; the root `faculty.ts`/`faq.ts` were not walked because they only aggregate the same folders) |
| Raw course entries in source | 5 501 (`'CODE - Title': [{ slot, venue, faculty }]` keys, counted once per file) |
| Harvested offering rows | 10 902 (per-folder index files re-export the same arrays, so entries are seen twice) |
| Deduplicated CSV rows | 2 746 (identical `CODE`+`TITLE`+`SLOT`+`FACULTY`+`VENUE` tuples collapsed after whitespace normalization, which also folds fresher-batch `_F` folders' repeats of main-folder offerings) |
| Distinct course codes | 357 |
| Schools with data | 12 of 20 — `SBST`, `SCHEME`, `SCE`, `SELECT`, `SMEC_F`, `MTech_SCOPE_F`, `SBST_F` (and the categories not listed above) are empty object literals upstream, so no rows exist for them in the source at all |

Note: the implementation plan's estimate of "5 502 rows / 783 courses" counted
raw per-folder key occurrences; after deduplication the catalogue is 2 746 rows
/ 357 codes. The count was cross-checked with two independent extraction
methods (vm-evaluation of the transpiled modules, and a regex parse of the
source text) which agree exactly.

Conversion date: **2026-10-29**.

## How to regenerate

```sh
node scripts/convert-codechef-catalogue.mjs [path/to/ffcs/src/data]
```

The script (`scripts/convert-codechef-catalogue.mjs`) transpiles each source
file with the repo's installed `typescript` and evaluates it in a `node:vm`
sandbox — no network access, no API. Output is deterministic: the same input
produces byte-identical CSV.

## Data shape & derivation heuristics

The CSV uses the header the planner's report loader already accepts, plus the
originating school:

```
CODE,TITLE,TYPE,CREDITS,SLOT,FACULTY,VENUE,EMPLOYEE SCHOOL
```

Two columns are **derived**, not verbatim from the source, and students should
treat them accordingly:

- **TYPE** — the source has no TYPE column. Every slot of an offering that is a
  lab slot (`L\d…`) makes the row `LO`; otherwise the row is `TH` (an offering
  whose slot mixes theory and lab parts would be `TH`; none exist in the current
  data). This matches the vocabulary of the bundled previous-semester report.
- **CREDITS** — the source has no credits either. A row's credits are taken from
  an **exact course-code join** against AmazeCC's two bundled reports
  (`public/ffcs/winter-2026-2027-slot-timetable.csv`, then
  `public/ffcs/ffcsReport.csv` as fallback; the winter report wins on conflict,
  and a code recorded under both a theory and a lab row matches by TYPE). When
  the code appears in neither report the heuristic **lab = 1, theory = 3** is
  used — the two dominant credit classes in those reports. In the current
  build: 1 830 rows joined from the winter report, 243 from the previous report,
  431 fell back to theory = 3 and 242 to lab = 1.

Everything else (`SLOT`, `FACULTY`, `VENUE`, course codes and titles) is copied
from the source, with whitespace trimmed.

## Offline guarantee

This CSV ships as a **same-origin static asset of AmazeCC**
(`public/ffcs/codechef-vit-catalogue.csv`, served at
`/ffcs/codechef-vit-catalogue.csv`). The planner loads it with a plain same
origin `fetch` — it never contacts `api.amazecc.com` or any CodeChef server, it
is cached by the service worker like the other bundled reports, and the FFCS
planner works fully offline once the app shell is installed.
