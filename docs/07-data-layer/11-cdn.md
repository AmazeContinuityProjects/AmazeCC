---
title: "The Media CDN (cdn.amazecc.com)"
description: "Cloudflare in front of real file storage — faculty photos, posters, static marketing art — migrated URLs so VTOP- and Supabase-hosted images load sanely everywhere."
---

# 11 — The Media CDN (cdn.amazecc.com)

> **In one line:** Cloudflare in front of real file storage — faculty photos, posters,
> static marketing art — migrated URLs so VTOP- and Supabase-hosted images load sanely everywhere.

## Responsibilities

- Serve images with long-lived immutable cache headers (`Cache-Control: public, max-age=31536000, immutable`)
- Hide source-of-origin domains from the client (Supabase/WordPress never appear in markup)
- Rewrite legacy URLs at edge? No — rewriting happens client-side via `toCdnImageUrl()`

## `toCdnImageUrl()` contract (`lib/workerBase.ts`)

Input → if already `cdn.amazecc.com` → return as-is.
Supabase `.co/storage/v1/object/public/...` → swap origin to cdn.
VIT WordPress host images → cdn equivalent path.

## What this is **not**

- Not authenticated storage. Private assets never touch the CDN.
- Not upload infrastructure — uploads go B2/Supabase through the API.

## Quiz

1. Why must `vitfacService.ts` route photos through the CDN instead of direct hotlinks?
2. Which file performs client-side URL normalization, and what are its two rewrite rules?
