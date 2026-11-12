# Social — Known Issues (full)

1. **Coarse-only peers look empty** — their grid is busy-only; full detail requires explicit full upgrade.
2. **Grant asymmetry** — if A is full-disclosure to B but B is coarse to A, A sees B's busy map
   but not B's course identities; UI must not imply otherwise.
3. **Busy map drift** — peer timetables baked at pairing time; VTOP re-scrapes on demand — a peer who
   changed courses mid-semester shows stale hours until they pull a sync on their side.
4. **Group reordering** — drag-and-drop order is client-local; losing your order on refresh means
   nothing broke — it's just not persisted yet.
5. **Alumni edge** — pairing with a graduate fails the semester match with a polite message — data from their old term is retained nowhere by us.
