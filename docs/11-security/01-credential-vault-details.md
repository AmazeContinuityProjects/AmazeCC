# 01 — The Credential Vault (Details)

> **In one line:** AES-256-GCM with a non-extractable key held only in IndexedDB — the page can
> _use_ stored credentials but cannot export them.
> **Read:** `lib/credentialVault.ts`. Deeper context: `07-data-layer/06-credential-vault.md`.

## Key material flow

```
first ever boot
 → open IndexedDB (amazecc-vault / keys / id="cred-v1")
 → no key found → generateKey({name:"AES-GCM", length:256, extractable:false, usages:["encrypt","decrypt"]})
 → persist raw CryptoKey in IndexedDB
after boot
 → storage.prototype patched for localStorage keys: IDs, PASSWORD, MOODLE_PASSWORD,
   KOHA_PASSWORD, VITOL_PASSWORD, EVENT_HUB_SESSION
 → values at rest are {iv, ciphertext, v:1} base64 under `cred_vault_v1`
 → old plaintext discovered → re-packed → plaintext deleted
```

## What it protects against — and what it doesn't

✅ Protects: casually-opened devtools Storage view; profile exports; casual malware with read access to the profile dir dump (to a degree); shared-computer sight-reading.

❌ Doesn't protect: live XSS inside the same origin — an attacker who can run JS can ask the page to decrypt in-process (CryptoKey is non-extractable, but `crypto.subtle.decrypt` from _our_ code still works). CSP and dependency hygiene (§06) are the real XSS story — the vault is defense in depth.

❌ Doesn't protect: extensions with granted access to this origin (they see everything).

## Failure postures — none of them leak

- IndexedDB unavailable → vault silently no-ops to plain localStorage (degraded, not broken).
- Key lost while blob remains → values unreadable → user re-authenticates (safe default).
- Demo mode → vault never touches it.

## Quiz

1. Name three files/keys the vault intercepts on `Storage.prototype` and one thing that is
   **never** vaulted.
2. Why is `extractable: false` load-bearing?
