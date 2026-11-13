# Events & Clubs — Architecture (honest boundaries)

> **In one line:** two systems (EventHub public + clubs) bridged through AmazeCC-API, with
> eligibility math done server-side and rendered client-side.

## 1. Event Hub (via AmazeCC-API → eventhubcc.vit.ac.in)

```
/api/events*  (enclave behind VTOP session — jsessionid)
  → list festivals, filtered by branch/year/degree
  → registration → VTOP-grade API mint → server updates attendance of the event
  → receipt minted by EventHub (end-to-end, server-mediated)
```

The jsessionid never leaves the client↔API edge — EventHub never sees our origin; AmazeCC-API
acts as the identity bridge. Certificate eligibility computed server-side and surfaced as boolean.

## 2. Clubs (directory + feed)

- Club directory: server-scraped from club source sites + curated DB rows
- Feed: per-club announcements — markdown from club admins; moderation is server-side
- Apply flow: opens VTOP's club-registration flow — we never bypass it

## 3. Cache policy

Lists cache for a short window (hours); feed entries always fresh with pull-to-refresh;
registration status requires live API (never stale — that's how you miss deadlines).

## 4. What this tab never promises

- It never tells a student they're "in" an event — VIT decides eligibility; the UI mirrors it.
- It never pays dues on their behalf.
- It never aggregates other students' attendance without explicit opt-in (there is none; the model
  doesn't include it).
