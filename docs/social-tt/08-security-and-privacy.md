# Security and Privacy

A timetable is a weekly record of where a person is. That is the most sensitive data this app handles — more so than attendance percentages or marks — and it is worth being precise about what is and is not protected.

---

## 1. Threats this design addresses

### Enumerable identifiers, exposed records

The naive version of this feature keys storage on a caller-supplied registration number and offers a `GET ?regNumber=…`. VIT registration numbers are sequential and publicly derivable, so `GET /api/social/sync?regNumber=21BCE1234` would return any student's friends, venues and timetable, and `POST` would let anyone wipe that student's list. The old merge would then propagate the poisoned payload back into the victim's own `localStorage` via `pullSocialFromCloud`.

**Closed by:** the owner key is derived from a VTOP response, not from a request field, and the read is authorised by a grant secret rather than by naming a target. There is no code path where a request parameter selects whose row to read.

### Unauthenticated writes to a statistics store

Worth fixing regardless of this feature, and it is the pattern that would have been copied. `POST /api/marks/sync` has no auth call at all (`marks/sync/route.ts:34-45`) and accepts `user_hash` — an unsalted, browser-computed SHA-256 of a login id — straight from the body. It also accepts a client-supplied `timestamp` and writes it through unvalidated, so `timestamp: 9e15` locks out legitimate updates for that key permanently. `GET /api/marks/stats` is equally open, so anyone can enumerate cohort statistics for any class.

**Not fixed here** — it is a separate change — but it is the precedent this design deliberately departs from, and it is why "the server validates a key" is a real property here and not a formality.

### Reflected-origin CORS with credentials

`AmazeCC-API/src/proxy.ts:15` echoes the request's `Origin` into `Access-Control-Allow-Origin` together with `Access-Control-Allow-Credentials: "true"`. Any website can therefore make credentialed cross-origin requests and read the responses. It does not expose the new routes on its own — the grant secret is not ambient, and a forged cookie pair fails at VTOP — but it weakens everything else in the API.

**Not fixed here.** It needs a real allowlist env var and affects every existing route, so it belongs in its own change with its own review.

### Secrets sharing

`ADMIN_SECRET` and `ID_SALT` are set to the same value in the current `.env`. One key is the HMAC secret for every admin and club token; the other is the salt that turns a registration number into the `owner_key` pseudonym. Reusing one value means compromising either compromises both, and the two protections are not independent. `SOCIAL_GRANT_SECRET_KEY` is a third, distinct value for the same reason.

**Action:** use three distinct values, and rotate the existing two — they have been co-located, and the B2/Supabase/VTOP credentials in that same file should be rotated if it has ever left the machine.

## 2. Threats this design does *not* address

Stated explicitly, because the coarse/full toggle invites over-reading.

| Threat | Status |
|---|---|
| The server operator reading stored timetables | **Not addressed.** The server stores the full record and applies coarse as a read-time redaction. Coarse protects against *other students*, which is the real peer threat. It does not protect against the operator or a full database compromise |
| A client lying about its own timetable | **Addressed.** The busy map is derived server-side from VTOP; the client never supplies it |
| A peer inferring a course from coarse data | **Partially.** Coarse reveals *when* someone is busy. Recurring over weeks that is a schedule. It does not reveal what the class is or where |
| A compromised client reading its own peers | **Not addressed.** The secrets are in `localStorage`, reachable by any XSS. The app already stores credentials in `localStorage`, so this is the existing posture, but a grant secret is a more valuable target than a cached marks blob |
| Metadata leakage from the handle | Handle is random and reveals nothing. Pairing state is per-grant and not enumerable |

## 3. What coarse and full actually reveal

| | Coarse | Full |
|---|---|---|
| Stored | course, code, venue | course, code, venue |
| Returned over the wire | **nothing but the slot keys** | everything |
| Supports "free right now" | yes | yes |
| Supports "common free slots" | yes | yes |
| Supports "what class is she in" | no | yes |
| Reveals physical location | no | yes |

Coarse supports both features the tab actually exists for. Full is for people who want the detail.

## 4. Grant secret handling

- 32 random bytes from `crypto.randomBytes`, base64url. Not derived from anything.
- Stored server-side as `HMAC(SOCIAL_GRANT_SECRET_KEY, secret)`. A database read alone does not yield usable secrets.
- Returned **only** to the two participants, only on their own sync route. There is no admin route that lists secrets, and no support flow that can retrieve one.
- Compared by hash, so the constant-time concern is moot — but `timingSafeEqual` is used anyway, matching `auth.ts:67-69`.
- Blanked from logs. `Logger.ts:20-22` already scrubs 24-hex ids, digit runs and `[A-Z]{2}\d{5,}`-shaped ids from logged paths; grant secrets are base64url and would not match, so they are excluded by never appearing in a path.

## 5. Rate limiting

| Action | Limit | Why |
|---|---|---|
| `identity/sync` | 20 / min / IP | Each call is 3–4 VTOP requests; this bounds the load a single caller can put on VTOP, which is a third-party system being scraped |
| `pair/claim` | 30 / hour / person | Bounds handle enumeration |
| `timetable` read | 120 / min / person | A peer list of 200 with a naive client would otherwise be 200 requests per render |
| `grant/revoke`, `grant/visibility` | 60 / min / person | |

The `identity/sync` limit is deliberately tight because it is the only amplification path in the API: one client request becomes several VTOP requests. The existing `checkRateLimit` is an in-memory `Map` (`rateLimit.ts:3`), so on Vercel it is per-instance and best-effort. That is the existing pattern and it is adequate for abuse-shaping, not for hard enforcement — a hard limit needs a shared store, which is a separate piece of infrastructure.

## 6. Input validation

Every array and string is bounded, mirroring `marks/sync/route.ts:49-52`:

- `busy_map` ≤ 164 keys, each `DAY:SLOTID` validated against the server's own vocabulary — an unknown key fails the **whole** publish, because a partial accept yields a timetable that looks complete and is not
- `courses` ≤ 60, each string ≤ 200 chars
- grants ≤ 200 per person
- `handle` matched against a strict pattern before any query, so it cannot be used for injection even though everything else is parameterised

## 7. Privacy behaviour worth calling out in the UI

- **Staleness is disclosed.** A peer's `lastPublishedAt` is shown, and anything over 14 days is badged. A stale record is not a neutral record — it may be actively wrong, since someone who dropped a class still shows as busy.
- **Pairing is disclosed as mutual** before the claim button is enabled.
- **Either party can end it**, and that is stated on the pairing row rather than buried in help text.
- **Publishing is a user action.** The server derives the caller's own timetable whenever they sync, which is the same trust the app already places in VTOP, but the *sharing* of it is a separate, deliberate act. Nothing is published to a peer without a grant.

## 8. Residual risk accepted

The peer who has stopped opening the app. Their record freezes and every comparison involving them is potentially wrong, and there is no way for the server to refresh it without a stored session. This is the direct cost of not storing credentials, it is inherent to the design rather than a bug, and the only real mitigations are the staleness badge and a nudge to sync.
