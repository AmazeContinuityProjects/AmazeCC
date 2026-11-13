# Libraries — Architecture (deep)

> **In one line:** OPAC via Koha — public catalog search anyone can use; patron account only with VTOP — both readable, neither writable.

## 1. Catalog search (no auth)

OPAC JSON endpoint behind the app's API proxy — sanitized loosely-typed data: shelves, items,
location, status ("On shelf", "Borrowed", "Reserved"). Searches fuzzy-match title/author/ISBN; paging included.

## 2. Patron account (auth: vtop)

Dues + fines + current checkouts — VTOP-warded patron login is mediated (we never hold Koha creds);
tokens derived from the VTOP session. Fines amounts are exact; due dates authoritative — show exactly what Koha says.

## 3. Cover images

Koha gives http URLs; `BookCover.tsx` normalizes to https + CDN wrapper (via `toCdnImageUrl`);
average cover weight ~40 KB; 200 covers/session cap internal throttle.
