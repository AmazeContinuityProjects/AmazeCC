# 05 — Mocking Guide

> **In one line:** mock the boundary you own — the engine barrel, the CDN, the worker — never
> "fetch with arbitrary return values".

Most mocked modules (in this repo, frequency):

| Module                         | Typical mock                                   | Used by                                |
| ------------------------------ | ---------------------------------------------- | -------------------------------------- |
| `@/lib/sync-engine`            | `{ sync: vi.fn().mockResolvedValue(fixture) }` | most screens test against engine fakes |
| `sync-engine/request-layer`    | `{ apiRequest }` implementation + `AuthError`  | failover/unicc tests                   |
| `credential-manager`           | is-stale/flags, session stubs                  | login flows                            |
| `vitfacService`                | `useFacultyRatings`-style hooks                | course faculty cards                   |
| `tesseract.js`                 | returns preset texts                           | scanner suites                         |
| `next/navigation`              | `useSearchParams/router stub`                  | route-param tests                      |
| `framer-motion`, `next-themes` | thin shells                                    | render parity                          |
| `localStorage` (helper)        | per-test installer (see 06)                    | 60+ suites                             |

## Mock hygiene

- Reset explicitly: `vi.clearAllMocks()` in `beforeEach` — state leaks between tests are real
- Shared fakes belong in `__tests__/mocks/` if reused ≥3 times (none yet — candidate for WP-12)
- When mocking `apiRequest`, remember `resolveApiRoute` — tests mock one layer only
