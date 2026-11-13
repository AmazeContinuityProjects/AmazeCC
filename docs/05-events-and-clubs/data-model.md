---
title: "Events & Clubs — Data Model"
---

# Events & Clubs — Data Model

`EventHubEvent = { id, title, club, venue, date, tags[], certificateEligible, registered, receipt? }`
`Club = { name, type, mission, members[], events[] }` — see `types/data/eventhub.ts`.
