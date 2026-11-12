# Friend Finder — Architecture

Route `/friend-finder` (public, [[friend-finder/layout]] not present — public page).
Auth gate is a modal VTOP login (shareable entry point) — the app never sees the page without verification passing.
Same engine as social/ffcs-match; only exposed classIds leave the device.
