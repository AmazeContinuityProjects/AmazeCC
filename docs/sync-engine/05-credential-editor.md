# Sync Engine — Credential Editor ("Edit Password")

## Problem it solves
Today, if a user's stored VTOP/EventHub password is wrong, the app keeps trying to log in from many components → VTOP sees a burst of attempts → **account lockout**. We already added a `failedLogin` give-up cache in `auth.ts`, but:
- the user has **no in-app way to correct the password** without the app possibly re-hammering;
- EventHub has no give-up at all.

The credential editor is the safe path to fix wrong credentials, and it is the only sanctioned way to change stored credentials once the engine owns them.

## Where it lives
- A single **"Edit credentials"** entry point, surfaced in two places:
  1. The login screen / error state — when `engine.login` throws `AuthError`, the error UI shows an **"Edit credentials"** button (instead of just "Try again", which could re-hammer).
  2. Settings / Profile area (`ProfilePage.tsx`) — a **"Change / edit saved password"** row, always available when logged in, so users can update a rotated password without logging out.
- Opens a modal (`CredentialEditorModal`) with username + password fields (prefilled from `storage.ids`), plus a note: *"We'll verify once; if it fails we stop — your account won't be locked."*

## Behavior (safe by construction)
On submit, the modal calls `engine.editCredentials(nextIds)`:
1. `CredentialManager` clears `failedVtop`/`failedEventHub`/`backoffUntil` and both sessions.
2. Persists `nextIds` to `storage.ids` (and `storage.password` per current `clearAllData` keep-set).
3. Calls `loginVtop(nextIds)` **exactly once**.
   - Success → sessions cached; engine runs `syncAll()` to refresh data; UI closes modal.
   - Auth failure → `CredentialManager` sets the give-up cache + backoff and throws `AuthError`. **No further attempts.** Modal stays open with the error and the button remains — the user can fix the typo and submit again; each submit is a single attempt separated by backoff.
4. EventHub credentials use the same `VtopUsername`/`VtopPassword` today, so `loginEventHub` is attempted once too (with its own give-up).

Key safety properties:
- **One attempt per submit**, never a loop.
- **Backoff** between submits prevents rapid-fire (the "fix typo fast" case can't lock the account).
- Because the engine is the only caller of `/api/login`, no mounted tab can independently re-attempt with the bad password.

## Distinction from "Change VTOP password"
- `editCredentials` = update the **password the app stores** to log in (local secret). Implemented by the engine.
- `changePassword` (existing `ProfilePage` → `/api/change-password`) = **change the actual VTOP password on the server**. Keep as a separate operation (`changePassword` in the registry). They are different flows; the editor is for the stored secret, the server-change is for the real credential.

## UI copy (suggested)
- Button: **"Edit credentials"**.
- Helper: *"Wrong password? Update it here. We verify once and stop if it fails, so VTOP won't lock your account."*
- On `AuthError`: *"Still can't sign in. Double-check your password — we've stopped retrying to avoid locking your account."*

## Implementation notes
- `CredentialEditorModal` uses `useSync()` (no `API_BASE`/`fetch`).
- On success it can call `engine.syncAll({ force: true })` to refresh everything through the engine.
- Accessible: focus trap, Enter-to-submit, password show/hide, confirm field optional.
