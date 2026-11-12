# 00 — The Web Foundation (read this once)

> **In one line:** Everything you need to know about how the web works before you open a
> single source file in this repo.
> **Audience:** everyone — regardless of experience. Skimming is allowed; skipping is not.

## Why this exists

AmazeCC is a _large_ codebase, and it becomes readable once you understand the three jobs
any web app does: **draw pixels in a browser**, **remember things locally**, and **ask a
server for data**. Every architecture decision in this app is one of those three — wearing a
costume. This section teaches the three from zero, then maps them onto this repository.

If you have built web apps before, use this section as a refresher for _our_ vocabulary
(SW, atom, static export, demo mode, VTOP). If you have not, read every page in order.

## The tour, in reading order

1. **[01-what-a-web-app-is](01-what-a-web-app-is.md)** — client vs server; what a browser does with a URL
2. **[02-html-css-js](02-html-css-js.md)** — the three layers; what survives from React back to raw HTML/CSS/JS
3. **[03-the-build-step](03-the-build-step.md)** — node, pnpm, bundling, why we build before shipping
4. **[04-typescript-in-10-minutes](04-typescript-in-10-minutes.md)** — types, interfaces, why `strictNullChecks` is off here
5. **[05-react-mental-model](05-react-mental-model.md)** — components, props, state, hooks
6. **[06-next-app-router](06-next-app-router.md)** — pages, layouts, and how folders become URLs
7. **[07-static-export](07-static-export.md)** — why AmazeCC ships plain files, and what that forbids
8. **[08-state-vs-server-state](08-state-vs-server-state.md)** — UI state (atoms) vs cached server truth (localStorage)
9. **[09-cookies-sessions-tokens](09-cookies-sessions-tokens.md)** — who holds the login; the vault
10. **[10-pwa-and-service-workers](10-pwa-and-service-workers.md)** — offline, precaching, install
11. **[11-http-and-apis](11-http-and-apis.md)** — requests, JSON, CORS, timeouts
12. **[12-the-repo-layout](12-the-repo-layout.md)** — our fork of "normal" Next.js layouts
13. **[13-common-footguns](13-common-footguns.md)** — SSR vs client, hydration, the misfires you _will_ hit

After this section, continue to **[01-getting-started](../01-getting-started/README.md)**.

## Before you start: four sentences about AmazeCC

1. It runs **no server**: the app is plain HTML/CSS/JS files on a static host (GitHub Pages).
2. It talks to a **separate backend** (AmazeCC-API) over HTTPS, which itself scrapes VIT's VTOP.
3. **The student's VTOP credentials live in the browser only**, encrypted on disk.
4. Most "screens" are not URLs — they are components switched by app state; a few (`/ffcs`,
   `/friend-finder`) are real URLs.

Everything in this tree explains one of those four sentences in depth.

## Quick quiz (check yourself)

If you can answer these after reading, you are ready for the code:

1. What does a browser do between typing `https://amazecc.com` and seeing pixels?
2. Why can't this app use a middleware or its own API route?
3. Where does the server-side JavaScript run, and why do we not trust it with the login?
4. What is the difference between a "prop" and "state" in React?
5. Name two places this app keeps data permanently besides the server.
