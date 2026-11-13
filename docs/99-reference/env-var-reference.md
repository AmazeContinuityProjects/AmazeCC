# Environment Variable Reference

> Every `NEXT_PUBLIC_*` referenced anywhere in `src/` + `.env.example`. Regenerate:
> `Select-String 'process\.env\.[A-Za-z_][A-Za-z0-9_]*' src -Recurse`
> If it's not here, it doesn't exist. **Blank = allowed** unless noted.

| Variable                            | Default (source)                             | Used by                                                         | Purpose                                                  |
| ----------------------------------- | -------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_BASE_PATH`             | `""` (.env.example)                          | `getAssetPath`, 22 refs                                         | base path for GitHub Pages (pinned empty — root hosting) |
| `NEXT_PUBLIC_API_URL`               | `https://api.amazecc.com` (fetch-utils)      | `fetchWithFailover`, `request-layer`, `posthog` (identity-hash) | primary AmazeCC-API origin                               |
| `NEXT_PUBLIC_BACKUP_API_URL`        | `https://amazecc-api-d402b5.rivendeploy.com` | `failoverBackupUrl`                                             | global failover sibling (UniCC refused here)             |
| `NEXT_PUBLIC_UNICC_API_URL`         | `https://api-unicc.arya22.dev`               | `unicc-fallback.ts`                                             | third-party fallback origin (scoped allowlist only)      |
| `NEXT_PUBLIC_UNICC_FALLBACK`        | unset (fallback enabled)                     | `unicc-fallback.ts`, kill-switch for fallback                   | set `"off"` to disable UniCC entirely                    |
| `NEXT_PUBLIC_WORKER_BASE`           | `https://cache.amazecc.com`                  | `workerBase.ts`                                                 | cached public data (buses, laundry, mess, changelog)     |
| `NEXT_PUBLIC_CDN_BASE`              | `https://cdn.amazecc.com`                    | `workerBase.ts`                                                 | media CDN prefix for Supabase/WordPress images           |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`      | — (Push)                                     | `PushNotificationManager`                                       | Web Push subscription key                                |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | built-in public `phc_obkUK…`                 | `posthog.ts`, `instrumentation-client`                          | analytics token (public-by-design)                       |
| `NEXT_PUBLIC_POSTHOG_HOST`          | `https://shoot.amazecc.com`                  | everywhere PostHog inits                                        | telemetry ingest via first-party proxy                   |
| `NEXT_PUBLIC_POSTHOG_PROJECT_ID`    | —                                            | build tooling                                                   | source-map uploads                                       |
| `NEXT_PUBLIC_POSTHOG_UI_HOST`       | `https://us.posthog.com`                     | `posthog.ts`                                                    | UI links for support dialogs                             |
| `VAPID_PRIVATE_KEY`                 | — (server-only)                              | AmazeCC-API only                                                | **never** shipped here                                   |
| `MONGODB_URI`                       | — (legacy)                                   | nothing in this repo                                            | pre-static-export leftovers in `.env.example`; inert     |
| `B2_*`                              | — (legacy)                                   | server-side only                                                | inert here                                               |
| `ADMINS` / `ID_SALT`                | — (legacy)                                   | server-side only                                                | inert here                                               |

## Build-time vs run-time

`NEXT_PUBLIC_*` vars are **compiled in** — changing one requires redeploy. All other variables are
server-side or inert; this repo never reads them at runtime.

## CI pins

`ci.yaml` and `nextjs.yml` explicitly set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BACKUP_API_URL`,
`NEXT_PUBLIC_UNICC_API_URL`, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Any fork must supply its own values.
