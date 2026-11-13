---
title: "What Actually Matters to Test Here"
description: "the contracts that make this app trustworthy — share links, slot math, frozen receipts, deletion of data on logout."
---

# What Actually Matters to Test Here

> **In one line:** the contracts that make this app trustworthy — share links, slot math,
> frozen receipts, deletion of data on logout.

1. **Share-link round-trip** — a student shares a week; a friend opens it on iPhone; the same
   grid must render. This _fails silently_ if it breaks — that's why it's first in the battery.
2. **Slot vocabulary** — slots are a closed enum in this codebase; a new VTOP spelling
   with no matching entry = silently missing classes.
3. **Deterministic generation** — the cartesian walk has an explicit cap; reproducibility for
   tests requires pruning heuristics to be pure functions of input.
4. **Marks receipts** — a server/client mismatch must surface; never auto-merge silently.
5. **Credential lockout** — too many wrong passwords → stop trying; this protects real students' VTOP accounts.
6. **Vault byte-compat** — the vault patches `Storage.prototype`; any drift corrupts every secret on every user's machine.
7. **Service worker exclusions** — precaching an image/CSV blows up the install on metered networks.
8. **/~offline exists** — a service worker pointing at a route that doesn't get built means a blank page.
9. **Logout actually forgets** — not just atoms; storage/vault purged or account persists for the next user on a shared machine.
