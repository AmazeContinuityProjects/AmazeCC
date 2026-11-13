---
title: "The Content Security Policy (decoded)"
description: 'a <meta httpEquiv="Content-Security-Policy"> because there is no server to set headers — with every directive explained in plain words.'
---

# 07 — The Content Security Policy (decoded)

> **In one line:** a `<meta httpEquiv="Content-Security-Policy">` because **there is no server to set headers** — with every directive explained in plain words.
> **Source:** `src/lib/csp.ts`; injected in production by `src/app/layout.tsx`.

## Why meta, and what it costs

`frame-ancestors` and `report-uri` are impossible in a meta CSP — noted as accepted risk (no
server to enforce clickjacking protection; mitigated by X-Frame-Options absence but… it's a
static site, embedding it in an iframe is possible but no credentials leak anyway).

## The directives, decoded

| Directive                   | Value                                                                                                             | Plain meaning                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `default-src`               | `'self'`                                                                                                          | anything not listed is only from us                                              |
| `script-src`                | `'self' 'unsafe-inline' 'wasm-unsafe-eval' googletagmanager.com shoot.amazecc.com *.posthog.com cdn.jsdelivr.net` | our bundles + GA + PostHog + optional lib; WASM for tesseract.js                 |
| `style-src`                 | `'self' 'unsafe-inline'`                                                                                          | Tailwind needs inline style attrs from React bits                                |
| `img-src`                   | `'self' data: https:`                                                                                             | any https image (VIT/WordPress/CDN/Koha covers)                                  |
| `connect-src`               | `'self' https: wss:`                                                                                              | all XHR/fetch/WebSocket targets (deliberately broad — user-suppliable API hosts) |
| `object-src`                | `'none'`                                                                                                          | no Flash/Java plugins                                                            |
| `base-uri`                  | `'self'`                                                                                                          | `<base>` tag restricted                                                          |
| `form-action`               | `'self' eventhubcc.vit.ac.in`                                                                                     | forms only to us + EventHub                                                      |
| `frame-src`                 | `'self'`                                                                                                          | iframes only to ourselves                                                        |
| `worker-src`                | `'self' blob:`                                                                                                    | our workers                                                                      |
| `font-src`                  | `'self' data:`                                                                                                    | self-hosted fonts                                                                |
| `manifest-src`              | `'self'`                                                                                                          | manifest from us                                                                 |
| `upgrade-insecure-requests` | present                                                                                                           | upgrade any http:// request to https://                                          |

## What it blocks in practice

Attacker-hosted scripts can't load anywhere except the whitelisted hosts (all analytics/CDN
pins). Injected inline `<img src=x onerror=…>` still can't run our own JS from a different
origin — exfiltration paths get narrowed to the hosts we already trust.

## Quiz

1. Name two directives impossible in a meta CSP and the residual risk.
2. Why does `connect-src` have to be broad?
