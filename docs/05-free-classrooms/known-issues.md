# Free Classrooms — Known Issues (full)

1. **8:30 vs 8:30S** — VIT's slot table has two mutually-exclusive mappings that the parser can't
   disambiguate statically; the silent-failure list covers exactly these three cases, and the app
   shows "can't verify" rather than lie.

2. **New building slot tables** — VIT introduced a building "MB-3" in 2026-spring without updating
   the PDF; the fallback says "rooms free" incorrectly. The cross-check is the only protection —
   hits hard in week 3 of mid-terms.

3. **Guest lectures vs booked rooms** — VIT allows venues reassigned by the administration on the
   fly; our data cannot see an admin's private swap — expect an occasional "occupied by important
   professor" surprise.

4. **Remote/hybrid sessions** — VIT sometimes runs online classes; room empty but "occupied" on
   paper. The VTOP answer reflects enrollment, not physical presence.

5. **Lab equipment bookkeeping** — a "free" lab may lack supervision; actually using one is a
   social problem VIT enforces, not us.
