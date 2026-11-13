---
title: "Glossary"
---

# Glossary

> Every acronym and term used anywhere in the live `docs/` tree, one line each.
> Grown from `grounding/08-glossary-seed.md`; extend in the same PR as any new term.
> (The grounding file is the seed — this is the authority.)

## Web platform

**Browser** — the program that downloads and runs the app (Chrome, Safari, Edge).
**URL (Uniform Resource Locator)** — the address a browser fetches; here, mostly `https://amazecc.com/…`.
**HTTP (Hypertext Transfer Protocol)** — the request/response language browsers and servers use.
**HTTPS (HTTP Secure)** — HTTP encrypted via TLS; what every AmazeCC host uses.
**GET / POST / PUT / DELETE** — HTTP methods: GET asks for data, POST sends data. The app
uses POST for everything credentialed.
**Header** — metadata attached to a request/response (Content-Type, Authorization…).
**Body** — the payload of a request/response; here, JSON.
**JSON (JavaScript Object Notation)** — ubiquitous data format: `{"key": "value"}`.
**Status code** — numeric result class: 2xx OK, 4xx client (e.g. 400 missing fields, 401/403
auth), 5xx server.
**CORS (Cross-Origin Resource Sharing)** — browser rules for calling a different domain; why
an open API (`Access-Control-Allow-Origin: *`) matters here.
**Cookie** — a small string the server sets and the browser stores and resends; VTOP sessions
arrive as cookies carried in memory and in the vault.
**localStorage / sessionStorage** — browser key/value stores; this app leans on localStorage
hard (cache + demo flag), sessionStorage for ephemeral bits.
**IndexedDB** — larger async browser database; used for the credential vault's CryptoKey.
**Cache-Control** — response header deciding freshness; part of the SW's job here.
**CORS preflight (OPTIONS)** — safelisted-request check before cross-origin POST.
**WebSocket / SSE** — not used. (EventHub pings are plain fetches.)
**Static hosting / CDN (Content Delivery Network)** — files served from edge nodes (GitHub
Pages + Cloudflare). No compute at the edge for this app.
**TLS (Transport Layer Security)** — certificate-based encryption/identity of hosts.
**HSTS (HTTP Strict Transport Security)** — forces HTTPS after first visit.
**CSP (Content Security Policy)** — whitelist of what the page may load/run, delivered here via
`<meta httpEquiv>` because there's no server to set headers.
**Origin** — scheme + host + port triplet the browser uses for permission decisions.
**SameSite** — cookie scope attribute; note VTOP-style cookies are not SameSite-restricted here.
**Redirect (301/302/307)** — server-driven navigation; mostly unused (static export).
**DNS (Domain Name System)** — name→IP lookup; CNAME record aliases one domain to another.
**CDN edge / origin** — the edge serves cached files; the origin is where uncached fetches hit.

## Tooling & frameworks

**Node.js** — JavaScript runtime used to run Next.js at build time and tools locally.
**npm / pnpm** — package managers; pnpm is used (content-addressed store, strict peers).
**Package / dependency** — a reusable unit of code from the registry (the `package.json` list).
**Lockfile** — `pnpm-lock.yaml` pins every version; never hand-edit it.
**Bundle** — the minified JS sent to the browser; code-splitting defers chunks on demand.
**Transpile** — translating TSX→JS and modern→compatible JS at build time.
**ESM (ES Modules) / CommonJS** — module systems; Next builds here prefer ESM.
**Static export** — `output: "export"`: build once to plain files; no server runtime.
**SSR / SSG / ISR / RSC** — server rendering / static generation / incremental / React Server
Components. This app uses none of these at runtime — everything is client components +
static HTML shell, with one exception worth documenting: `/ffcs` prefetch + Suspense.
**Hydration** — attaching React behavior to already-painted HTML; gaps cause flicker/errors.
**Client component** — `"use client"` file; runs in the browser (this is everything interactive
here). **Server component** — renders at build/server time only.
**Route group / layout** — parens folders (`(app)`) sharing a `layout.tsx` without affecting URL.
**File-based routing** — `foo/page.tsx` ⇒ `/foo`; `layout.tsx` wraps all children; `loading.tsx`
= suspense fallback; none exist here except `/ffcs`'s.
**React.lazy / dynamic()** — defer loading a component's JS until needed (used everywhere).
**React component** — a function returning JSX; UI building block.
**Hook** — React's function API to add behavior (`useState`, `useEffect`, …).
**State / prop** — prop flows in, state is owned.
**jotai** — atomic state library; micro-stores (`atom(...)`) subscribed by components; this
repo keeps UI atoms in `src/store/`.
**Framer Motion** — animation library (sheet transitions, layout cards).
**Tailwind CSS** — utility-class styling; v4 with `@import "tailwindcss"` in globals.css.
**PostCSS** — CSS pipeline; here just Tailwind + a couple of plugins for builds.
**Serwist** — service-worker toolkit (successor to next-pwa); powers `src/app/sw.ts`.
**Vitest** — test runner (Jest-like API, Vite-fast); no jsdom-global config except component setups.
**@testing-library/react** — renders components in jsdom for tests; no jest-dom assertions.
**ESLint / Prettier** — lint (catch bugs/style) and format (whitespace); run per commit via husky.
**TypeScript (TS)** — typed JavaScript; this repo turns `strictNullChecks` OFF for pragmatism.
**CI (Continuous Integration)** — automation that lints/typechecks/tests/builds every push.
**SWA / GitHub Pages** — static site host for the built app.
**CNAME** — file that pins which custom domain GitHub Pages serves.
**env var (NEXT_PUBLIC\_*)** — build-time-inlined configuration; public by definition.
**source map** — mapping bundle bytes back to TS sources; uploaded to PostHog for errors.

## Network & backend boundaries

**API (Application Programming Interface)** — the contract the backend serves; here: AmazeCC-API.
**Endpoint / route** — one URL+method+purpose on that API (`POST /api/ffcs`).
**Payload / request body** — JSON object sent; here almost always credentials + options.
**VTOP (Vellore Institute of Technology Online Portal)** — official student portal this app replaces.
**AmazeCC-API** — separate repo: server that scrapes VTOP and serves this app (api.amazecc.com).
**Supabase** — managed Postgres (server-side only); e.g. push_subscriptions.
**B2 (Backblaze)** — S3-compatible object storage (receipts, uploads) — server-side.
**Cloudflare / Worker / CDN cache** — `cache.amazecc.com` (worker: precomputed public data);
`cdn.amazecc.com` (media CDN in front of Supabase/WordPress).
**Cache** — stored copy sold to you as "fast"; our localStorage is a write-through cache of
server truth, with staleness semantics students must understand.
**Failover** — automatic switch to a backup API when the primary is down (NOT on wrong passwords).
**UniCC (api-unicc.arya22.dev)** — third-party "better VTOP" API used as scoped fallback only.
**Captcha** — anti-bot challenge on VTOP login; solved server-side; why logins are slow (~5–10 s).
**Session cookie (VTOP)** — the browser's proof of login; here held in memory + vault, 10-minute TTL.
**authorizedID** — opaque VTOP session id (~10-char); **not persisted** in jotai.
**CSRF token (\_csrf)** — VTOP's anti-forgery value, required on POSTs, sent with every credentialed call.
**rate limit** — protection against abusive call volume; we back off, not retry-storm.

## Academics domain

**CAT / FAT** — continuous assessment test / final assessment test (VIT midterms & finals).
**CGPA / GPA** — cumulative / semester grade point average.
**Credits** — course weight; GPA is credit-weighted.
**Grade boundary** — score→letter mapping, relative or absolute (tables in `gradeBoundaries.ts`).
**Slot system (VTOP)** — letter codes for period/day grid (A1, TA1, B2 …). See slot algebra doc.
**Time slot vs class id** — slot says _when_; class id says _which section of which course_.
**FFCS (Foreign Language Credit System / Full Flexible Ch..?)** — VIT's flexible course-selection
driven timetable; the planner's whole reason for existing. (Expand per docs' own usage — verify.)
**Time table / timetable** — the weekly grid; exported to PDF/JPG/iCal from here.
**OD (On-Duty)** — approved absence; counted separately from attendance (and wasted).
**EPT (English Proficiency Test)** — first-year qualifying exam.
**Hostel counselling** — VTOP hostel services (allotment/leaves/counselling).
**LMS (Learning Management System)** — VIT's Moodle instance; deadlines appear in tasks.
**Vitol** — VIT's lab-work portal; assignments surfaced in the dashboard.
**Grade history** — past semester records fetched as unified payload.
**Effective grade** — best-vs-declared grade reconciliation (gradesEffective.ts semantics).
**Cohort marks stats** — class-level distributions computed server-side; shown as curves.
_\*frozen_marks_* / marksFrozenV1_* — immutable client snapshots of accepted marks writes.
**assessmentKey** — SHA-256(`classId::component::normalizedTitle`) shared w/ server.

## PWA & offline

**PWA (Progressive Web App)** — installable web app; here adds home-screen icon, push, offline pages.
**Service worker (SW)** — background script mediating network & cache; Serwist-managed.
**Precache** — files fetched at install-time into the SW cache (static shell).
**Runtime cache** — on-demand caching (NetworkFirst pages, CacheFirst JS chunks).
**Offline fallback** — `/~offline/` served for failed document loads.
**Web Push / VAPID** — server-initiated push using a public/private key pair; subscriptions held server-side.
**share_target (Web Share Target)** — route the OS "Share…" sheet posts `/share/ffcs?…`.
**beforeinstallprompt** — Chromium install event; iOS requires manual instructions.

## UI & state vocabulary

**Atom (jotai)** — minimal state cell; `useAtom(xAtom)` subscribes.
**Selector / derived atom** — computed value from other atoms (rare here; mostly plain vars).
**Bottom sheet** — sliding-up modal panel; the app's native modal idiom on mobile.
**Overlay stack** — registry of open overlays to guarantee back-gesture order.
**Subpage / drill-in** — in-tab navigation without a route change (subpage stack).
**Shell** — the signed-in chrome around feature content (sidebar + header + sheets).
**Feature boundary** — dynamic-import wrapper splitting a product area's JS from first paint.
**Design token** — named style constant (zinc variants, spacing scale) — see uiTokens.ts.
**Tailwind dialect** — "zinc" palette conventions; see design-notes docs.
**Tour / spotlight** — step-by-step highlight overlay teaching a screen (TOUR_VERSION).
**Logo/chepu** — the banana mascot used in empty/celebration states (design content).
**Privacy mode** — setting that blurs grades/attendance/marks/fees values for shoulder-surfing.
**Skip link** — keyboard-access link jumping past chrome; a11y requirement.
**Focus trap** — keyboard containment inside a modal (BottomSheet implements).
_*aria-* / role_* — accessibility attributes; `role="dialog"` etc. used on sheets.

## Process & hygiene

**WP (work package)** — a documentation unit scoped in 05-work-packages.md.
**WP-xA / WP-xB** — lettered splits of one WP when executed across sessions.
**Handoff** — transfer of ownership; this docs tree is the handoff artefact.
**ADR (Architecture Decision Record)** — short doc capturing one decision + rationale (`99-reference/decisions/`).
**Runbook** — steps an operator follows to fix a production issue.
**Definition of Done** — checklist proving a task is complete (see 06-verification.md).
**Front-end handoff contract** — expectation that docs are accurate enough to change code against.
