---
title: "The Pre-Paint Session Snapshot"
description: 'an inline <script> in layout.tsx reads localStorage before React exists and stamps <html class="has-stored-session"> — the CSS that hides the guest landing for returning students.'
---

# The Pre-Paint Session Snapshot

> **In one line:** an inline `<script>` in `layout.tsx` reads `localStorage` before React exists
> and stamps `<html class="has-stored-session">` — the CSS that hides the guest landing for
> returning students.

## Why at all

Static export has no cookies and no per-user HTML. Without the hint, every returning student
would see a flash of the marketing hero (or worst, the wrong CTA) on every cold load — the
"option doesn't exist" tell.

## What it reads (exactly)

```js
var d = localStorage.getItem("IDs"); // parseable + VtopUsername → stored
var u = localStorage.getItem("username"); // + password → stored
var m = localStorage.getItem("demoMode"); // "true" → stored
var v = localStorage.getItem("cred_vault_session"); // "1" → stored
if (any) document.documentElement.classList.add("has-stored-session");
```

## Why this is safe with CSP

Inline `<script>` is in the meta CSP's `script-src 'unsafe-inline'` window — legitimately,
because the alternative is an XSS-shaped hole or a slower first paint; the script is one-way
(class stamp, zero data exfil paths). If the CSP meta is ever removed, this is the first thing
to re-audit.

## The companion (`has_stored_session` in globals.css)

`.has-stored-session .guest-only { display: none !important }`
`.guest-only` variants hide guest CTAs from returning users in the pre-hydration window.

## Quiz

1. Why can't this hint live inside React's first render?
2. What happens on a machine where localStorage is unavailable?
