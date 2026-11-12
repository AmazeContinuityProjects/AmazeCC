# Libraries — Known Issues

1. OPAC HTML changes with VIT's library portal upgrades — scraper selectors have a maintenance cadence.
2. Patron account requires live VTOP — no cache; if you're offline, dues don't render at all (by design).
3. Book covers are http-only URLs from Koha; rewriting must preserve query params.
