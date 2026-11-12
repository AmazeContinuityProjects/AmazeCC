# 02 — Home Entry Controller

> **In one line:** `src/components/custom/app/HomeEntryController.tsx` decides in milliseconds —
> landing hero or the app — before React ever commits to either.
> **Read:** `HomeEntryController.tsx`, `readBootstrapSnapshot.ts`.

## The trick, in one sentence

Read the _minimum_ localStorage in render (not in an effect), via `useSyncExternalStore` — so
there is exactly one answer for "who is this?" from the very first frame.

```tsx
function readSnapshot(): boolean | null {
  // null = hasn't looked yet; true/false = looked
  try {
    const ids = storage.ids.get(); // string|null
    const u = storage.username.get();
    const p = storage.password.get();
    const hasVtop = !!(ids?.VtopUsername && ids?.VtopPassword) || (!!u && !!p);
    return hasVtop || storage.demoMode.get() === true || storage.hasVaultSession.get();
  } catch {
    return false;
  }
}
```

`hasStoredAppSession()` (here or in `readBootstrapSnapshot.ts`) is what gates:
guest sections render instantly for empty profiles; the dynamic `Main` chunk downloads only
when needed — returning students never pay for the landing hero bundle at boot.

## Gesture contract

- `null` → render `<OpeningScreen/>` (one branded heartbeat)
- `false` → landing hero + `GuestExperience` (scrollable marketing)
- `true` → dynamic `Main` mounts; restored session path continues (no re-login)

## Quiz

1. What would break if the gate used `useEffect` + `useState` instead of `useSyncExternalStore`?
2. Which class on `<html>` is set pre-paint and where?
