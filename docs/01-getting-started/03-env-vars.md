---
title: "Environment Variables"
description: ".env.example lists every knob; for local demo work you need none of them; anything that ships to students is compiled in at build time with the defaults in src/lib/fetch-utils.ts et al."
---

# 03 — Environment Variables

> **In one line:** `.env.example` lists every knob; for local demo work you need none of them;
> anything that ships to students is compiled in at build time with the defaults in
> `src/lib/fetch-utils.ts` et al.
> **Reading time:** ~8 min.

> 🔒 **Privacy:** this file is for variable _meanings_, never values. `.env` is gitignored and
> must stay that way.

## The table

| Variable                            | Default (if blank)                           | What it does                                                                           | Where read                                                |
| ----------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`               | `https://api.amazecc.com`                    | Primary backend for every credentialed call                                            | `lib/fetch-utils.ts`                                      |
| `NEXT_PUBLIC_BACKUP_API_URL`        | `https://amazecc-api-d402b5.rivendeploy.com` | Failover host — swapped in for all requests when the primary is down (never for UniCC) | `lib/fetch-utils.ts`                                      |
| `NEXT_PUBLIC_UNICC_API_URL`         | `https://api-unicc.arya22.dev`               | Third-party fallback host for an _allowlist_ of paths                                  | `lib/unicc-fallback.ts`                                   |
| `NEXT_PUBLIC_UNICC_FALLBACK`        | (unset = on)                                 | Set to `off` to disable the UniCC fallback entirely                                    | `lib/unicc-fallback.ts`                                   |
| `NEXT_PUBLIC_WORKER_BASE`           | `https://cache.amazecc.com`                  | Cloudflare Worker for cached public data (buses, laundry, changelog)                   | `lib/workerBase.ts`                                       |
| `NEXT_PUBLIC_CDN_BASE`              | `https://cdn.amazecc.com`                    | Media CDN (faculty photos)                                                             | `lib/workerBase.ts`                                       |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`      | (none)                                       | Web Push public key — subscribes this browser to push                                  | `components/…/PushPromptModal`, `PushNotificationManager` |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | built-in (public project token)              | PostHog analytics/events                                                               | `lib/posthog.ts`, `instrumentation-client.ts`             |
| `NEXT_PUBLIC_POSTHOG_HOST`          | `https://shoot.amazecc.com`                  | PostHog ingest host (first-party proxy)                                                | `lib/posthog.ts`                                          |
| `NEXT_PUBLIC_POSTHOG_PROJECT_ID`    | (none)                                       | Project id — source-map uploads, some scripts                                          | build tooling                                             |
| `NEXT_PUBLIC_POSTHOG_UI_HOST`       | `https://us.posthog.com`                     | Linked from the support dialog                                                         | `lib/posthog.ts`                                          |
| `NEXT_PUBLIC_BASE_PATH`             | `` (empty)                                   | Deployed sub-path; this repo pins `""`                                                 | `.env.example` doc only                                   |
| `VAPID_PRIVATE_KEY`                 | —                                            | **Server-only** (AmazeCC-API). Never needed here                                       | ignored by this repo                                      |

## `.env.example`'s legacy entries

`MONGODB_URI`, `B2_*`, `ADMINS`, `ID_SALT`, `VAPID_PRIVATE_KEY` are from the era when this repo
held server code. They do **nothing** in this frontend and may still appear in `.env.example`
so existing setups don't break — ignore them.

## How the defaults get baked in

`next build` statically inlines `NEXT_PUBLIC_*` into the JS bundle. That's why:

- Changing a default means a rebuild, never a config edit on the host.
- CI (`ci.yaml`/`nextjs.yml`) pins these at build time explicitly; local builds inherit your shell.
- A `.env.local` in the repo root silently changes the app _without you noticing it in the bundle_ —
  check `NEXT_PUBLIC_*` when debugging "works on my machine".

## Demo-mode needs no env

All demo paths short-circuit before the network; the only env you might set for local work is
`NEXT_PUBLIC_UNICC_FALLBACK=off` if you want to prove zero third-party calls.

## Quiz

1. Why is it unsafe to put a "secret" into a `NEXT_PUBLIC_*` var?
2. Where does the app read `NEXT_PUBLIC_API_URL`, and what happens if it's set to localhost?
3. Why is `.env` gitignored?
