---
title: "Marks Predictor — Storage & State"
---

# Marks Predictor — Storage & State

> State is local, ephemeral, honest — nothing in this feature is pushed anywhere.

`predictor_custom_courses` (what-if courses) · `predictor_mocks_v1` (named snapshots) ·
`predictor_tour_seen` (tour gate)

Read from atoms: current marks + cohort stats (if synced). Nothing writes anywhere but `localStorage`.
