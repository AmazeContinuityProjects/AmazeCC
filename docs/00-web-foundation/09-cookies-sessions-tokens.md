---
title: "Cookies, Sessions & the Vault"
description: "VTOP proves you logged in with cookies; this app keeps them in memory, and at rest they're AES-256-GCM encrypted by the browser — nothing leaves the device."
---

# Cookies, Sessions & the Vault

> **In one line:** VTOP proves you logged in with cookies; this app keeps them in memory,
> and at rest they're AES-256-GCM encrypted by the browser — nothing leaves the device.
> **Audience:** everyone. **Reading time:** ~8 min.

## What a session cookie actually is

When you log into VTOP (via AmazeCC-API's `/api/login`), the API solves VIT's captcha and
returns:

```json
{ "success": true, "cookies": "JSESSIONID=…; JSESSIONID=…", "csrf": "abc123", "authorizedID": "25BCE1234" }
```

- **cookies** — the proof. Any browser tab holding them can act as you on VTOP (within the
  session window, ~10 minutes of inactivity server-side).
- **csrf** — a token VTOP demands on every form post (it re-checks it each request).
- **authorizedID** — your registration number-ish identifier; the UI badges use it.

## What this app does with them

| State           | Where                                               | Why                                                             |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| live session    | memory (`credential-manager.ts`)                    | fastest; cleared on tab close / logout                          |
| at-rest secrets | **encrypted** in localStorage under `cred_vault_v1` | survives refresh; invisible to someone skimming your Storage UI |
| encryption key  | non-extractable `CryptoKey` in **IndexedDB**        | the page can _use_ it but not read it; XSS can't copy it either |
| pre-paint hint  | `has-stored-session` class on `<html>`              | instant "returning user" landing before React boots             |

All of this lives in `src/lib/credentialVault.ts`. The vault deliberately patches
`Storage.prototype` for only the sensitive keys, migrates legacy plain-text on first boot,
and never logs values.

## What you must **not** do

- Never `console.log` a cookie or csrf — the docs rule applies everywhere, including tests.
- Never widen the vault's key list casually — every key added there is a promise.
- Never put cookies in the URL (share links carry the timetable, never credentials).
- Never sync it to the server — the API re-logs in on your behalf using the same creds you
  type in; there is no "session upload" endpoint by design.

## Why not a server-side session at all?

Because the student typed the password once on this device — it's their device, their browser
memory, their disk. A hosted session would put every student's VTOP password into our custody,
which serves no feature and adds only liability. See ADR-0002 in `99-reference/decisions/`.

## Quiz

1. Where does the AES key that decrypts the vault live, and why there?
2. Why is `authorizedIDAtom` never persisted?
3. What happens to the vault if IndexedDB is unavailable (old WebView)?
