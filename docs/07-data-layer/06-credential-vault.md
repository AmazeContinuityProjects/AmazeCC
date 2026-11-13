---
title: "The Credential Vault (Data Layer)"
description: "AES-256-GCM, IndexedDB-held non-extractable key, localStorage-intercepted values — the at-rest boundary for the 6 sensitive keys. See 11-security/01-credential-vault-details.md for threat-model…"
---

# The Credential Vault (Data Layer)

> **In one line:** AES-256-GCM, IndexedDB-held non-extractable key, `localStorage`-intercepted
> values — the at-rest boundary for the 6 sensitive keys.
> See `11-security/01-credential-vault-details.md` for threat-model context.

## Layout at rest

```
localStorage
  cred_vault_session = "1"            // presence flag for pre-paint hint
  cred_vault_v1      = {iv, ciphertext, v:1}   // ONE blob for ALL sensitive keys
  IDs                = (plaintext if migration pending, then absent)
  (old plaintext keys deleted by migration sweep)
```

IndexedDB `amazecc-vault`: keys → `cred-v1` (CryptoKey, non-extractable, usage encrypt/decrypt only).

## What the vault intercepts (via Storage.prototype patch)

`IDs`, `password`, `moodle_password`, `koha_password`, `vitol_password`, `eventHubSession`.

## Behavior at boot

1. `credentialVault.ts` opened pre-hydration by `instrumentation-client.ts`
2. existing plaintext migrated silently (and logged via logger at low priority)
3. `VAULT_READY_EVENT` dispatched — consumers wait for it before reading secrets

## Failure matrix

- **IndexedDB blocked** (private mode w/ cookies disabled) → vault silently degrades to plain localStorage — documented, accepted.
- **Blob corruption / key loss** → values unreadable → user re-auth (never data loss, just re-prompt).
- **Multiple browsers** → each keeps its own key — sharing impossible, by design.

## Quiz

1. Where does the key live, and why is it not extractable?
2. What fires before React that makes the pre-paint `has-stored-session` class work?
