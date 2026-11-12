# Friend Finder (FFCS) — Architecture

Client computes classIds from the planner picks (`ffcsClassmates.ts`) → POST `social/ffcs-match` (auth: vtop) → server returns matched classmates (already friends & strangers, capped lists).
Friends subpage: add by handle/link, groups, per-friend timetable visibility (full/busy-only), revoke.
