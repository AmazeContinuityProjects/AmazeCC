---
title: "Half Works / One Thing Broken"
description: "one bad cached key usually poisons one surface — find which key and delete it."
---

# 03 — Half Works / One Thing Broken

> **In one line:** one bad cached key usually poisons one surface — find which key and delete it.

- **All of academics broken** → `allGrades` / `cache_curriculum` — clear in devtools, refresh
- **Only OD numbers odd** → `frozen_marks_*` colliding with od — check console for drift log line; usually VTOP re-uploaded papers (server truth wins on next sync)
- **FFCS planner blank course list** → `course_dashboard_target` corruption in localStorage — delete, reload
- **Sidebar missing items** → `settings` key lost migration — clear `settings` → defaults restored
- **Attendance never loads** → `vtopSession` stale with no creds → forget credentials → sign in
