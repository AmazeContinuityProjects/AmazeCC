# Onboarding — Architecture (deep)

> **In one line:** the first-run experience: theme pick → sign-in or demo → full sync — three beats, skippable, resumable — never blocks the app from working.

## 1. The flow

```
/ → guest landing
  → Get Started → intro page → pick track (Sign in · Demo · Explore without data)
  → Sign in → captcha → full sync → welcome tour
  → Welcome → landing home (returning users never see this again)
```

## 2. Gating

`showIntroAtom` — set false on first completed onboarding; survives in localStorage; forgetting
creds clears it again (you re-onboard on next login if you do a fresh device).

## 3. The welcome tour

TOUR_VERSION-gated on onboard completion: highlights sidebar areas — students see it once per release per device.
Skip always possible; settings replays.
