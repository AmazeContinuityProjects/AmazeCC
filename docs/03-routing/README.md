# 03 — Routing & Navigation

> **In one line:** two routing systems coexist — the browser's URLs (few, public) and the app's
> tab state (many, instant) — plus one command palette to jump between them.

Read in order. Each page is self-contained but the union covers the full navigation surface.

1. [01-next-routes.md](01-next-routes.md) — every real URL: `/`, `/ffcs`, `/friend-finder`, `/share`, …
2. [02-tab-router.md](02-tab-router.md) — the client-side screen switcher inside the signed-in app
3. [03-navigation-registry.md](03-navigation-registry.md) — the module registry that feeds sidebar, palette, deep links
4. [04-the-share-routes.md](04-the-share-routes.md) — Web Share Target + lz-string payloads
5. [05-static-export-routing.md](05-static-export-routing.md) — trailing slashes, 404, Pages quirks
6. [06-command-palette-and-shortcuts.md](06-command-palette-and-shortcuts.md) — ⌘K + `g`-sequences
7. [07-screen-locking-nav.md](07-screen-locking-nav.md) — overlays eat Back before pages do
8. [08-deep-linking.md](08-deep-linking.md) — `?tab=` and sign-in return paths
