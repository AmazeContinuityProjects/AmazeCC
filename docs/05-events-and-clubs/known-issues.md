# Events & Clubs — Known Issues (full)

1. **Eligibility flip lag** — a student who completes the prerequisite quiz at 10 PM may still show "ineligible" at 10:01; VTOP caches eligibility — expect next-day sync.
2. **Event PDF receipts** — EventHub issues delayed receipts after the event; the tab shows "available in ~24h".
3. **Club feed noise** — clubs without moderation users can spam; report button escalates to the org's moderation rota.
4. **Duplicate posts** — clubs cross-posting to multiple feeds show twice — client-side dedupe by club+timestamp; false negatives rare but possible.
5. **Certificate mismatch** — a course code registered but not eligible gets a wrong certificate — VIT-side; we never merge these systems.
