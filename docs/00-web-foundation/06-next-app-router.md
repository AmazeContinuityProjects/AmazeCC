---
title: "Next.js App Router (how folders become pages)"
description: "in the app/ directory, folders are URLs, page.tsx is what renders, and layout.tsx wraps everything beneath it."
---

# Next.js App Router (how folders become pages)

> **In one line:** in the `app/` directory, folders are URLs, `page.tsx` is what renders, and
> `layout.tsx` wraps everything beneath it.
> **Audience:** everyone. **Reading time:** ~9 min.
> Local authority: `node_modules/next/dist/docs/01-app/` — verify against it, not against blog posts.

## The vocabulary

| File                  | Meaning                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `app/layout.tsx`      | the HTML shell (`<html>`, `<body>`); persists across navigations |
| `app/page.tsx`        | the page for `/`                                                 |
| `app/ffcs/page.tsx`   | the page for `/ffcs`                                             |
| `app/ffcs/layout.tsx` | wraps **only** `/ffcs` subtree (toolbars, metadata)              |
| `not-found.tsx`       | 404 UI for the segment (or the root)                             |
| `error.tsx`           | error boundary for the segment (client component)                |
| `global-error.tsx`    | replaces the root layout when _it_ throws                        |

This repo's routes: `/`, `/ffcs`, `/friend-finder`, `/friend-finder/disclaimer`, `/privacy`,
`/terms`, `/share`, `/share/ffcs`, `/~offline`. That is the **entire** public URL surface —
everything else is a screen mounted by the client (see `03-routing/`).

## Layouts don't re-render (and we rely on that)

A layout persists across child navigations — so global chrome placed in the root layout
(service-worker registrar, theme provider, icon updater) mounts once per session, not once
per page. AmazeCC uses this for both root (`layout.tsx`) and `/ffcs` (`ffcs/layout.tsx`,
with its own manifest and CSV preload).

## Server vs client components — why ours are all client

- **Server component** (default): rendered at build time (static export) → HTML. No event
  handlers, no hooks, no browser APIs.
- **Client component**: `"use client"` at the top → rendered in the browser, full React.
  AmazeCC marks interactive files `"use client"` — because everything here is interactive
  and depends on browser-only APIs (localStorage, cookies, VTOP state).
- **The rule you'll hit:** importing a client component _into_ a server component is fine;
  passing browser-only event handlers _to_ a server component is not. In practice in this
  repo: almost everything below `app/` is client; `page.tsx` files are thin shells.

## What you will **not** find here

- No `route.ts` API handlers (static export — see next page)
- No `loading.tsx` (we use skeletons inside client screens instead)
- No middleware / proxy (impossible under static hosting; `proxy.ts`-style support is
  documented in Next docs but applies to server deployments only)

## Quiz

1. What does `layout.tsx` own that re-renders never, and why do we put the theme provider there?
2. Why is every interactive component in this repo marked `"use client"`?
3. Given the URL `/friend-finder/disclaimer`, which files render?
