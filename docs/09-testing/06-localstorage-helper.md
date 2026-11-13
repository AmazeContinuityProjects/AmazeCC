---
title: "The localStorage Helper (src/__tests__/helpers/localStorage.ts)"
description: 'per-suite installation of an in-memory Storage-shaped object, because half our tests pin "localStorage is empty" and half need it seeded.'
---

# 06 — The localStorage Helper (`src/__tests__/helpers/localStorage.ts`)

> **In one line:** per-suite installation of an in-memory `Storage`-shaped object, because
> half our tests pin "localStorage is empty" and half need it seeded.

## What it installs

`globalThis.localStorage` and `window.localStorage` — own-enumerable keys, normal prototype
chain, `setItem/getItem/removeItem/clear/key/length` — byte-compatible with the vault's
`Storage.prototype` patches.

## When to use it

Any suite that touches anything reading storage **or vault**. Install first line of `describe`.
Call `installLocalStorage()` again between nested tests to fully reset (or seed per test).

## When not to

Unit tests with no I/O, or suites already pinning absence (vault migration tests do their own).
