# Feedback & Support — Architecture (deep)

> **In one line:** bug reports carry everything the maintainer needs to reproduce — except what you're not asked for.

## 1. The intake

```
Settings → Report a bug (floating bar or Settings)
   → form: text field + severity dropdown + "attach tech info" toggle (default on)
   → tech info: build sha, browser class, route, atom counts, last 30 console errors (their messages only)
   → POST /api/feedback → Supabase + email to maintainers
   → you get a reference code
```

## 2. The recorder (bug recording bar)

Captures canvas + user gestures for 60 s when you tap record; attaches a redacted replay (PII blurred
client-side pre-upload — names/reg numbers gated out by a regex pass).

## 3. Why not issue tracker directly

Students aren't GitHub users; this is support; PRs flow separately via docs/contributing.

## 4. Support conversations

PostHog Conversations threads — maintainers reply in-app; heavy repro back-and-forth stays in-thread.
