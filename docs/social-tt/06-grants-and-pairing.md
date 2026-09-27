# Grants and Pairing

The shared signed key: how two people give each other access, and what that actually means.

---

## 1. The model

Two people exchange handles. The server mints **one** grant, and both sides hold a copy of its secret.

```
A shows handle  AMZ-4F7K-2Q9X
B enters it   ──> POST /api/social/pair/claim  { handle: "AMZ-4F7K-2Q9X" }
                    server: ownerB = A (from handle)
                            ownerA = B (from the session)
                            stored sorted: least(A,B), greatest(A,B)
                            secret = 32 random bytes, base64url
                            secret_hash = HMAC(SOCIAL_GRANT_SECRET_KEY, secret)
                            secret_enc  = AES-256-GCM(SOCIAL_GRANT_SECRET_KEY, secret)
                            → returns { grantId, secret, peer: { handle, name, semesters } }
                    B stores the secret.
                    A learns about the grant on A's next sync and stores the same secret.
```

Either party can then read the other's timetable by presenting the secret. That is the "common to both" property: it is not two tokens, it is one token that both sides hold, and possession of it is what authorises the read.

## 1a. Why the secret is stored twice

An earlier draft of this document specified storing **only** `secret_hash` and then also expected the server to return the plaintext to the *other* partner on their next sync. That is not implementable: a hash cannot be reversed, so the non-claiming partner could never obtain the shared secret and would be permanently unable to read the timetable they had just been granted.

Since both sides must hold the secret, the server has to be able to recover it. So the row stores both:

| Column | Purpose |
|---|---|
| `secret_hash` | Indexed lookup — "which grant is this secret?" |
| `secret_enc` | `iv:tag:ciphertext`, AES-256-GCM, so the secret can be given back to a participant |

The encryption key is derived from `SOCIAL_GRANT_SECRET_KEY` with a domain-separation label (`social-grant-secret/aes-256-gcm/v1`) so the AES key and the HMAC key are never the same bytes. `secret_enc` is decrypted on exactly one path, and only for a caller who is a participant of that grant.

**What this does and does not buy.** A non-participant still cannot obtain a secret: every read path resolves the caller from the VTOP session and checks participation first. What it costs is that a database dump is no longer sufficient on its own — an attacker would also need the application key. Given the server already stores every timetable in plaintext, that is a marginal difference, and it is the right trade for mutual pairing working at all.

## 2. Read authorisation

```ts
const h = hmac(SOCIAL_GRANT_SECRET_KEY, presentedSecret);
const grant = await pool.query(
  `SELECT * FROM social_grants
     WHERE secret_hash = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
  [h]
);
if (!grant.rowCount) → 403 grant_invalid
const target = await pool.query(
  `SELECT * FROM social_timetables WHERE owner_key = $1 AND semester_id = $2`,
  [requestedOwnerKey, semesterId]
);
if (!isParticipant(grant.row, target.owner_key)) → 403 not_a_participant
```

Three properties fall out of this:

- **The reader's own identity is never trusted from the request.** It is derived from the session, as everywhere else. Presenting a grant secret authorises *access to a peer*; it does not let you become someone else.
- **A secret alone is not enough** — the caller *and* the target must both be participants of the grant the secret belongs to. Both checks return the same 403 `not_a_participant` so a caller holding a foreign secret cannot use the response to probe who is paired with whom. A leaked secret therefore exposes one specific peer to one specific person, not the whole graph.
- **Revocation is a single field.** `revoked_at` on one row kills both directions simultaneously, because both directions were that row.
- **Re-pairing reactivates the row rather than adding one.** `UNIQUE (owner_a, owner_b)` means at most one grant per pair, ever, so a revoked grant is repaired in place: a new `grant_id`, a new secret hash and ciphertext, and `revoked_at` cleared. This is what guarantees the old secret is dead — its hash is overwritten, not merely shadowed.

The lookup is a `secret_hash` index hit, so it does not depend on `least`/`greatest()` ordering at read time. The `UNIQUE (owner_a, owner_b)` constraint only guards writes.

## 3. Keys

`SOCIAL_GRANT_SECRET_KEY` is a **new** environment variable. It is not `ADMIN_SECRET` and not `ID_SALT`.

This matters more than it sounds. In the current `../AmazeCC-API/.env`, `ADMIN_SECRET` and `ID_SALT` are set to the same value. `ADMIN_SECRET` is the HMAC key for every admin and club token; `ID_SALT` is the salt for `maskUserID`, i.e. the pseudonym that stands in for student identity. Reusing one value for both means an attacker who obtains the token-signing key also holds the ID salt, and vice versa — the two protections are not independent. Adding a third key that is genuinely distinct is part of doing this correctly; collapsing it into the existing pair would make the new grant secrets no stronger than the old ones.

Required env for this feature:

| Variable | Used for | Failure if unset |
|---|---|---|
| `DATABASE_URL` | pool | Throws on first query, not at boot |
| `ID_SALT` | `maskUserID` | Throws inside `createHmac` at first call |
| `SOCIAL_GRANT_SECRET_KEY` | grant hashing | Route 500s; must fail loudly at boot, so add a startup assertion |
| `VTOP_BASE_URL` | VTOP client | Falls back to the public default |

Rotating `SOCIAL_GRANT_SECRET_KEY` invalidates every outstanding grant and forces all pairs to re-pair. Rotating `ID_SALT` orphans every `owner_key` and therefore every timetable row. Both are documented as irreversible in [13-open-questions.md](./13-open-questions.md).

## 4. Lifecycle

```
             claim                grant active              revoke
  strangers ──────> paired ────────────────────────> strangers
                        │                              ▲
                        │ expires_at passes            │
                        └──────────────────────────────┘
```

| Operation | Effect | Who can do it |
|---|---|---|
| Claim | Creates the grant; returns the secret to the claimer | Any authenticated student |
| Sync | Discovers grants involving you, returns their ids so you can store the secrets | The server pushes to both sides; neither has to "accept" |
| Read | Returns the peer's timetable, filtered by the grant's `visibility` | Either participant |
| Change visibility | `coarse` ⇄ `full` | **Either** participant |
| Revoke | Terminates both directions | **Either** participant |
| Unpair | Same as revoke, plus a client-side tombstone so the row is not re-created on next sync | Either participant |

**Neither side has an "accept" step.** This is a deliberate consequence of mutual pairing: if A had to accept, then B claiming A's handle would be a request, not a grant, and the flow would need a pending state, a notification, a timeout and a decline path — four pieces of machinery for a symmetric relationship. The cost is that claiming *is* consenting, which the UI must therefore make unmistakable (see §5).

Visibility is settable by **either** participant because in a mutual pair "either of us decides" is the only consistent rule. If A is full with B and B is coarse with A, a read is satisfied if **either** grant permits full — so the more permissive setting wins. This is deliberate: neither party can unilaterally hide information from the other, which would make the pairing incoherent. If that is the wrong trade for a given campus, the alternative is a per-direction visibility column, at the cost of reintroducing direction.

## 5. Consent UX

Pairing is symmetric and publishes a weekly map of someone's whereabouts. Three things must be true on screen before the claim button is enabled:

1. **Mutuality, stated.** "Pairing with Neha lets you see her timetable, and lets her see yours." Not a footnote.
2. **Granularity, chosen.** Coarse or full, with a live preview of exactly what each reveals. Coarse: "she is busy 14 slots a week". Full: "she has Database Systems in AB1-101, Tue 9:50".
3. **Reversibility, stated.** "Either of you can end this at any time."

The handle is shown on its own "My handle" row with a copy button and a QR code, so sharing is deliberate rather than ambient.

## 6. Why not a per-pair encrypted secret

A design where each pair has a key and the server stores only ciphertext would mean the server never sees either plaintext timetable. It was rejected:

- The server must store timetables anyway, so it already holds the plaintext. Encrypting the *pair's* view adds a key-management problem without removing a plaintext.
- Per-pair keys need a KMS, a rotation story, and a revocation path *per pair* rather than one row.
- It would not survive a peer switching visibility: re-encrypting for a new granularity is a re-key, and the peer's client would need to re-fetch and re-derive.

The property that actually matters — *a peer can read you only if you explicitly paired with them, and revoking severs it* — is fully provided by the grant. If server-blindness ever becomes a requirement, it is a separate project with its own threat model, not a variation on this one.

## 7. Limits

| Limit | Value | Reason |
|---|---|---|
| Grants per person | 200 | Bounds the peer list and the sync payload |
| Pair claims per person per hour | 30 | Stops handle enumeration |
| Grant secret | 32 bytes, base64url (~43 chars) | Comfortably above any realistic search |
| Default expiry | none | Revocation is the intended control, and a silent expiry would break a long-lived pair with no explanation |
| Optional expiry | settable at claim time, for a study group that ends | When set, enforced on every read |
