# Libraries — Known Issues (full)

1. **Koha outage = zero catalog** — the whole tab depends on the library's uptime; timeouts render "catalog unavailable" with retry.
2. **Fine rounding** — Koha-fine text occasionally arrives as `"Rs. 10.50"` with comma-thousands in some branches — regex normalize before compare.
3. **Overdue sync lag** — an item returned at 11:55 pm reads overdue at midnight; the sync engine's schedule is the cap.
4. **Covers for new publications** — Koha hasn't ingested images yet; fallback to generic book icon — cosmetic only.
