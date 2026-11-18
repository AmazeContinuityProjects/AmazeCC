# Unified timetable vocabulary

One physical period can be named by several slot tokens from different
programmes. `A1` (core) and `M1` (programme M) both name Monday 8:00–8:50; they
are **two distinct slots** that resolve to **one period** (`T01`). They must
never be deduplicated by time: a busy map, a share code, or a programme picker
may legitimately reference either token.

## Files

| File | Role |
|---|---|
| `schema/timetable.schema.json` | Shape contract (JSON Schema, draft 2020-12) |
| `campuses/chennai.json` | **Source of truth** for Chennai: days, periods, slots, programmes |
| `legacy/head-164-index.json` | Frozen v5/v6 share-code slot order from the pre-change `config.json` |
| `../../lib/generated/timetable.ts` | Typed accessors and lookups (generated) |
| `../../lib/generated/slotMap.json` | Flat `day → token → {time}` compatibility projection |
| `../../lib/generated/campusSchema.json` | Legacy `theory[] / lab[]` campus projection |

`config.json` and `src/data/campus/*.json` are compatibility projections for
consumers that have not migrated yet. Do not add slots to them by hand.

## Regenerate and validate

```sh
pnpm timetable:generate   # write all projections
pnpm timetable:check      # fail if generated output is stale (runs in pretest/prebuild/pretypecheck)
```

The generator refuses to drop or gain slots silently: `baseline` in the
canonical file records the slot/period/token counts captured at bootstrap.
It also asserts that at least one `(day, period)` has multiple programme
tokens — if that invariant disappears, the overlap model has been lost.

## Adding a VIT update

1. Edit only `campuses/chennai.json`.
2. A new naming system = new `programmes` entry; add its tokens as slots under
   the **existing** period they overlap, not new periods.
3. A genuinely new time = new period (`id` pattern `T##` / `L##` / `X##`).
4. Retired tokens stay with `status: "retired"`; never reuse an id.
5. Never reorder `legacy/head-164-index.json` — share codes depend on it.
6. Run `pnpm timetable:generate` and commit the regenerated files.

`vocabularyVersion` is a hash of the canonical data; the Hono social worker
still hardcodes `"v1"` and must be migrated separately before version
negotiation can be trusted.

## Open data decisions

- `programme_m/u/n/r/i` are placeholders; rename once the programmes behind
  those token families are confirmed.
- `L18`/`L24` use the new `12:35-1:25` time. `period.dayTimeOverrides` records
  where this diverges from the original campus lab time (`12:30-1:20`).
- Law aliases are explicit data on core theory slots; the old regex-derived
  aliases (`M → M`, `U → U`, …) are gone.
