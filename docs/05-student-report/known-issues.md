---
title: "Student Report — Known Issues (full)"
---

# Student Report — Known Issues (full)

1. **CGPA rounding** — we round per-step vs final-sum; VIT official CGPA may differ by ±0.01 — the report says "AmazeCC-computed, VIT is authoritative"
2. **FAT predictions** are for that semester only, using last synced marks — never stale-adjusted; refresh before exporting
3. **PDF size** — with timetable snapshots: 1–4 MB — email-friendly; image exports to JPG available separately
4. **Reg number watermark** — subtle on print but visible in file metadata text layer — don't attach to public forms
5. **International students** — name honored from VIT as-is (diacritics may mangle in jsPDF base fonts; cosmetic)
