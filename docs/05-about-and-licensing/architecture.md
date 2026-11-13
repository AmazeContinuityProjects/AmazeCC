---
title: "About & Licensing — Architecture (deep)"
description: "every line of AmazeCC is MIT; attributions to upstream projects are intact and audited at release time."
---

# About & Licensing — Architecture (deep)

> **In one line:** every line of AmazeCC is MIT; attributions to upstream projects are intact and audited at release time.

## The stack and its licenses (per `package.json`, at HEAD)

- next/react — MIT
- amazeui (this team) — MIT
- lucide-react — ISC
- tailwindcss — MIT
- framer-motion — MIT
- jspdf + html2canvas — MIT
- tesseract.js — Apache-2.0
- jsdom (dev only) — MIT

Vendored code copies (rare and documented inline): FFCSWalk pruning logic — inspired by FFCS-inator (MIT, permission granted by author).

Directives: keep LICENSE at root; re-scan on every dep bump with `pnpm list --json` + SPDX checker in CI (soft warning for unknowns).
