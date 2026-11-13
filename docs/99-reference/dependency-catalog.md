---
title: "Dependency Catalog (top, by why-not-just-ship-it)"
---

# Dependency Catalog (top, by why-not-just-ship-it)

> **Method:** `package.json` runtime deps ranked by size/importance; the rest noted at the end.
> Verify with `pnpm ls <pkg>` when in doubt.

## The load-bearing ones

| Package                                            | Why it's here                       | Heavy?      | Notes                                                       |
| -------------------------------------------------- | ----------------------------------- | ----------- | ----------------------------------------------------------- |
| `next@16`                                          | static export framework             | —           | read `node_modules/next/dist/docs/`, not your training data |
| `react@19` / `react-dom`                           | UI                                  | —           | everything is client components here                        |
| `jotai`                                            | atomic state (our atoms)            | small       | `src/store/`                                                |
| `framer-motion`                                    | sheet/page animations               | medium      | Labeled-dynamic chunks where needed                         |
| `tailwindcss@4`                                    | styling                             | —           | compile-time only                                           |
| `@amazecontinuityprojects/amazeui`                 | in-house component kit              | medium      | transpiled, vendored at pinned version                      |
| `lucide-react`                                     | icons                               | small       | pinned                                                      |
| `clsx` / `tailwind-merge`                          | class merging                       | tiny        | `cn()`                                                      |
| `lz-string`                                        | share-link compression              | tiny        | `/share/ffcs` payloads                                      |
| `jspdf` (+ `jspdf-autotable`)                      | client-side PDF exports             | heavy       | in workers (pdf.worker)                                     |
| `html2canvas`? (check HEAD)                        | image exports                       | heavy       | dynamic import only                                         |
| `tesseract.js`                                     | OCR (paper scanner)                 | huge (WASM) | dynamic import; retry-friendly                              |
| `xlsx`                                             | spreadsheet parsing (course import) | heavy       | dynamic import on upload only                               |
| `posthog-js`                                       | analytics/error/conversations       | medium      | first-party ingest host                                     |
| `@sentry-internal`? no — PostHog internal          | —                                   | —           | replaces Sentry                                             |
| `@serwist/next` + `serwist`                        | service worker                      | medium      | build-time plugin                                           |
| `next-themes`                                      | theme attribute                     | tiny        | `class` strategy, dark default                              |
| `@react-pdf/renderer`? absent — jsPDF used instead | —                                   | —           | jsPDF keeps bundle consistent                               |
| `sharp`                                            | asset pipeline (dev/scripts)        | heavy       | dev dep; not shipped in runtime bundle                      |
| `@next/third-parties`                              | GA integration                      | —           | thin                                                        |

## Everything else

Radix-ish amazeui deps (vendored), `timeago.js`? (not present — own `useNow`), zxcvbn absent,
no axios (fetch-wrapper only), no react-query (sync engine + atoms), no redux/mobx
(jotai by design), no styled-components (Tailwind+primitives), no lodash (native + own utils).

## Adding one: the justification bar

1. Can the platform (browser API / existing lib) already do it?
2. Is it server-side-only (then it's a dev dep, not a runtime dep)?
3. Does it change the bundle? By how much? (`next build` output report)
4. Does it need types? Ship them or drop `@types/*` alternative.
5. License compatible with MIT?
