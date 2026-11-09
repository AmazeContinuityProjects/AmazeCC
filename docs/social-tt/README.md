# Social Timetable Sharing — Design Docs

- **Status:** Designed, not implemented. Both empirical unknowns are now **resolved** against live VTOP (see [13-open-questions.md](./13-open-questions.md) §1).
- **Scope:** Move timetable sharing from "every client uploads every friend's timetable" to "each person publishes their own timetable once, the server is the source of truth for everyone else", plus a visual redesign of the Social tab to the Libraries / Simplified Mobile Home grammar.
- **Repos:** `AmazeCC` (Next.js frontend) and `../AmazeCC-API` (Next.js backend, PostgreSQL).

## What is in here

| Doc | Read it for |
|---|---|
| [01-overview.md](./01-overview.md) | The problem, the shape of the solution, and every locked decision with its rationale |
| [02-current-state-audit.md](./02-current-state-audit.md) | Evidence audit of both repos today. Every claim carries a `file:line`. Read this first if you want to argue with a claim. |
| [03-identity-and-semester.md](./03-identity-and-semester.md) | How the server learns who you are, and how "current semester" is resolved |
| [04-data-model.md](./04-data-model.md) | DDL, TypeScript types, the `busy_map` shape, slot-vocabulary versioning |
| [05-server-derivation.md](./05-server-derivation.md) | The VTOP call sequence, parsers, and how a busy map is built |
| [06-grants-and-pairing.md](./06-grants-and-pairing.md) | The shared signed key, mutual pairing semantics, lifecycle, revocation |
| [07-api-contract.md](./07-api-contract.md) | Every endpoint, request and response shapes, status codes, limits |
| [08-security-and-privacy.md](./08-security-and-privacy.md) | Threat model, and exactly what coarse/full visibility does and does not guarantee |
| [09-schedule-math.md](./09-schedule-math.md) | The 164-slot vocabulary, why `(day, slotId)` is the only correct key, overlap computation |
| [10-frontend-integration.md](./10-frontend-integration.md) | Sync engine op, atoms, storage keys, comparison helpers, legacy migration |
| [11-ui-redesign.md](./11-ui-redesign.md) | Landing + 4 subpages in the Libraries grammar |
| [12-migration-plan.md](./12-migration-plan.md) | Phased build order, cutover, v5/v6 deprecation |
| [13-open-questions.md](./13-open-questions.md) | Unresolved decisions, and the two verification risks with their probe |

## The one-paragraph version

Today each client holds a full copy of every friend's timetable in `localStorage` and re-uploads the entire set on every single click. The server has no timetable storage, no student identity, and no notion of the current semester, and the endpoint the client already calls (`/api/social/sync`) does not exist. The fix has the client authenticate with its existing VTOP session and the **server** do the deriving — scraping VTOP once to learn the person's real registration number, the current calendar semester, their timetable and their course allocation, then persisting a normalised `(day, slotId)` busy map. People exchange an 11-character handle, the server mints a shared signed grant that both sides hold, and every other read is a database lookup. Nobody ever uploads anybody else's timetable again.

## The single most important structural change

Today, deletions cannot propagate. `pullSocialFromCloud` merges local and remote by `id` with remote winning (`socialUtils.ts:539-546`), so removing a friend on device A resurrects them on device B. Server-owned records with explicit grants make deletion a single, authoritative operation.

## Verified against live VTOP

Three things only a real scrape could establish, all of which contradict what the source suggested:

1. **`Slot/ Venue` uses `" - "`, not `"/"`.** `"L31+L32+L37+L38 - AB1-607B"`. Splitting on `/` would have produced a busy map of invalid keys.
2. **The current semester cannot be read from the dropdown** — the `selected` option is always the empty `-- Choose Semester --` placeholder. Client-proposed, server-validated is the only mechanism, not a fallback.
3. **Course code and component type are explicit**, in `"BACSE102 - Problem Solving Using Java ( Lab Only )"` form. Neither has to be synthesised, and the existing synthesiser misclassifies `F1+TF1` as a lab.

The probe currently lives at `../AmazeCC-API/scripts/vtop-probe.ts` and runs with:

```bash
cd ../AmazeCC-API
node --env-file=.env --import ./scripts/probe-register.mjs scripts/vtop-probe.ts
```

**This stays on the developer's machine and is never committed.** `scripts/` is gitignored in that repo (`.gitignore:46`), which is what keeps it out of history — do not relocate it to a committable path. Login is attempted **exactly once**; any failure stops the probe with a loud banner rather than retrying, because a wrong captcha must be surfaced rather than papered over. Findings land in `vtop-probe-findings.json`.

One operational note it produced: `node --env-file` silently truncates an unquoted `#` in a value. The `VTOP_PASSWORD` in that repo's `.env` ended in `#` and was being read as 27 characters instead of 28, so VTOP received the wrong password. The value is now double-quoted, and the probe reports the parsed length so it cannot recur silently. No application code reads that variable, so the running API was never affected.
