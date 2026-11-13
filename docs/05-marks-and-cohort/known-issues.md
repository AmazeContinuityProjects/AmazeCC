---
title: "Marks & Cohort — Known Issues (full)"
---

# Marks & Cohort — Known Issues (full)

1. **σ is "learned at the seams".** Until ~8 receipts exist the server returns "not enough data" and the UI honestly says so.
2. **FAT weights differ by course** but the key is stable across variants — overlapping assessments can blur σ slightly; not catastrophic, documented.
3. **VIT re-uploads** (grading error corrections, moderation) propagate weeks later — drift warnings are normal around result season; the UI surfaces them with "server processed N records".
4. **Privacy misread** — the switch covers _classes you are enrolled in only_; mass-dispatch payloads are never requested. If you suspect otherwise, check network tab — there are no bulk uploads.
5. **Opt-out latency** — your last-opt-in receipts may remain in the pool; aggregation stops contributing from the toggle click forward.
