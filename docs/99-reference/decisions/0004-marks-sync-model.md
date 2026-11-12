# ADR-0004: Marks-Sync Privacy Model (hashed keys, frozen receipts, opt-in)

**Status:** accepted, production
**Context:** class averages are gold for students; raw marks are radioactive.
**Decision:** contribute (classId, component, title, score) — never identity; key = SHA-256(classId::component::normalizedTitle); server returns HMAC receipts; client freezes them (`marksFrozenV1`); drift is surfaced, not merged.
**Consequences:** zero identity at the server beyond class context; students can see their own contribution status; class averages are anonymous.
**Revisit when:** VIT changes assessment component granularity.
