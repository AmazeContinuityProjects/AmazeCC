# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

VIT University students managing their academics and campus life. AmazeCC is an alternative, mobile-friendly student operating system that combines data from multiple student portals into one unified command center with powerful data manipulation capabilities. The official VTOP portal is the incumbent it replaces.

## Product Purpose

Give VIT students a fast, modern, mobile-friendly command center for student life: aggregate attendance, grades, schedules, hostel, payments, events, library, and more into one place so students do not have to juggle clunky official portals. Success means a student can see and act on their complete academic and campus picture quickly on any device, with tools that turn raw portal data into decisions.

## Positioning

All-in-one aggregation of VIT student data plus a clash-free FFCS timetable generator (advanced generator, friend alignment, share links) — a combination a single-purpose portal cannot truthfully copy. Depth of data manipulation (attendance and GPA predictors, what-if simulations, grade-history analytics) and resilience through multi-mount API failover reinforce the claim.

## Operating Context

Used by VIT students on the web and mobile web (PWA, offline support, push notifications, touch navigation). Login uses VTOP credentials (username and password, optionally Moodle) with captcha solving; credentials and fetched data are cached in localStorage for instant UI. The app is served at amazecc.com; the hosted API is at api.amazecc.com with a Cloudflare Worker primary (hono.amazecc.com) and multiple fallback mounts. Demo mode loads fake data when no live credentials are available.

## Capabilities and Constraints

- Frontend: Next.js 16 (App Router), TypeScript 5.9, Tailwind CSS v4, Framer Motion, the AmazeUI shared component library, Jotai state, lucide-react, posthog-js analytics, serwist PWA. Dev server runs on :3001 (HTTPS).
- Backend: separate AmazeCC-API (Next.js API routes, PostgreSQL) with roughly 130 POST, 15 GET, and 10 admin endpoints; VTOP scraping via Cheerio, Axios, and tough-cookie.
- Admin dashboard: AmazeCC-Dashboard on :3002; manages fresher resources, buses, push notifications, and QBank content.
- API routing: every API is mounted from definition files (src/lib/apis/spec.json), never hardcoded; failover triggers only on 5xx, timeout, or network failure, never on 401. Onboarding shows a "Target server" picker by mount name.
- License: GNU GPL v3.0 (GPL-3.0-only).
- Fork of Arya4930/UniCC; captcha solver adapted from arshsaxena/ViBoot-Enhanced.
- Themes: light, dark, and midnight (midnight is the default).
- No additional user-stated constraints, brand commitments, or accessibility standards beyond what is documented in the repository.

## Brand Commitments

- Name: AmazeCC.
- Primary logo: public/images/icons/AmazeCC.png (the README centers it as the product mark); app-icon variants are also referenced in the docs.
- Voice, as documented: a fast, modern, intuitive alternative to the clunky official portal.

## Evidence on Hand

- README.md — product overview, feature table, architecture, API routing/mounts, and getting-started instructions.
- FEATURES.md — complete feature documentation (v3.1.0, refreshed 2026-11-10), covering 190+ frontend components and 130+ API endpoints.
- Live site: https://amazecc.com; API docs: https://api.amazecc.com/docs; API stats: https://api.amazecc.com/stats.
- LICENSE — GNU GPL v3.0; CODE_OF_CONDUCT.md.
- No testimonials, customer benchmarks, or third-party proof assets exist in the repository; do not fabricate them.

## Product Principles

1. One unified command center: aggregate every VIT student portal into a single coherent experience.
2. Mobile-first: the whole product must be genuinely usable and pleasant on a phone.
3. Turn data into decisions: predictors, planners, simulations, and analytics make raw portal data actionable.
4. Fast and resilient: aggressive local caching for instant UI, with multi-mount API failover to keep data available.
5. Replace without losing: supplant the clunky official experience while preserving all of its data and functions.
