# 01 — The Three Stores

> **In one line:** localStorage (string k/v, public-ish) < IndexedDB (crypto material) < the SW cache (asset bytes).
> **Pick one.** Reach for the cheapest store that survives your lifetime.

| Store                | Access      | Size                 | Lifetime                             | Used for                                                                                 |
| -------------------- | ----------- | -------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| localStorage         | sync        | ~5–10 MB             | tab/browser session, clear-on-logout | everything the UI needs on re-entry: settings, attendance, marks, demo flag, sync stamps |
| IndexedDB            | async       | GBs                  | until site data cleared              | the AES-GCM CryptoKey (non-extractable), the FFCS scanner store                          |
| Service Worker cache | SW-mediated | bounded (maxEntries) | until SW updated/reset               | wheels: app shell HTML/JS/CSS (NetworkFirst), JS chunks (CacheFirst), static assets      |
| sessionStorage       | sync        | k/v tab              | tab close                            | ephemeral generator session prefs, tour skip keys                                        |

## Picking the right store (rules of thumb)

- **Anything sync-critical for UI paint** → localStorage.
- **Anything that must be tamper-proof at rest** → vault over localStorage, key in IndexedDB.
- **Anything large and non-credential** (paper PDFs, images) → IndexedDB.
- **Never** Cache API or localStorage for secrets that would be painful to XSS-exfiltrate.

## The merge point

`StorageKeys` in `lib/storage.ts` — nearly everything flows through it (typed get/set with
JSON handling + safe quota failure). Prefer `storage.attendance.set(...)` over raw
`localStorage.setItem` — raw bypasses nothing today but loses the safety rails tomorrow.
