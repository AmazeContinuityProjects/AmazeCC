# 02 — The Four Manifests (and why)

> **In one line:** `manifest.json` (main app) · `manifest-fire.json` (variants) · `ffcs-manifest.json` (standalone FFCS PWA) · `site.webmanifest` (legacy bookmark chrome).

| Manifest                          | Purpose                 | start_url | scope    | Key extras                                                  |
| --------------------------------- | ----------------------- | --------- | -------- | ----------------------------------------------------------- |
| `public/manifest.json`            | AmazeCC home-screen app | `/`       | `/`      | `share_target` → `/share`, theme colors, display:standalone |
| `public/manifest-fire.json`       | icon variant test       | `/`       | `/`      | alternate icon set, no behavioral difference                |
| `public/ffcs-manifest.json`       | FFCS standalone PWA     | `/ffcs/`  | `/ffcs/` | FFCS.png icons, `FFCS — AmazeCC` name                       |
| `public/favicon/site.webmanifest` | legacy favicon-manifest | `/`       | `/`      | referenced by older browsers; icons/sizes only              |

## The share target (install-time treat)

`manifest.json#share_target`: `action: "/share"`, `method: "GET"`, `params: {title, text, url}` —
an OS-level "Share → AmazeCC" entry appears after install. Payload lands on `ShareTargetView`,
which routes it into the planner/course search.

## Swapping on route entry

`/ffcs` overrides via `ffcs/layout.tsx` + `IconUpdater.tsx` (favicon/apple-touch-icon/manifest
link swaps). The static head still carries the main-app manifest — the route-level override is
a runtime + metadata-level dual change, documented in 06-icon-updater.md.

## Quiz

1. Which manifest does an Android phone attach to when installing from `/ffcs`?
2. Why is `site.webmanifest` still shipped?
