# 10 — Notifications & Toasts (message atoms)

> **In one line:** a capped 60-line ring buffer of toast lines + a single progress bar — small
> feedback without ceremony, never a stack of stacking errors.
> **Read:** `store/uiAtoms.ts` (`messageAtom`, `progressBarAtom`), `LastSynced.tsx`,
> `sync-engine/sync-session.ts`.

## The `messageAtom` behavior

- Attaches to any number of contexts (toast, banner, settings status line)
- Dedupe + cap: storing beyond 60 drops the oldest — the UI must never OOM or scroll forever
- `LastSynced` reads the same feed for "Updated …" + one-tap retry of the failed op

## Toast etiquette in this codebase

- One line, no exclamation marks, action verb first ("Saved", "Sync failed — retry")
- Never stack more than one banner-type toast; chips/sheets for the rest
- Errors route to PostHog silently; toasts stay human

## Quiz

1. What does the atom cap protect? What ordering does it guarantee?
2. Which component turns the message stream into "Updated …" with a Retry?
