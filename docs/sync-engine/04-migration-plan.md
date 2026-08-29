# Sync Engine — Migration Plan

Goal: zero behavior change for users; every network call moves behind the engine; no component fetches directly. Done in phases so the app stays shippable.

## Phase 0 — Scaffold the engine (no behavior change)
1. Create `src/lib/sync-engine/` modules per `02-architecture.md`.
2. Move `loginToVTOP` + `loginToEventHub` logic into `CredentialManager` (keep the `failedLogin` give-up we already added; add EventHub give-up + backoff). Keep `auth.ts`/`event-hub.ts` as thin re-exports during transition (delete at end).
3. Implement `RequestLayer.request` wrapping the existing `fetchWithTimeout`/`fetchWithFailover` (dedup + backoff + retry).
4. Implement `StateBridge` (writes `storage` + atoms) and `ProgressBus`.
5. Create `useSync` hook.
6. Build a **lint guard** (eslint rule or `no-restricted-imports`) that bans, outside `src/lib/sync-engine/`:
   - importing `API_BASE` / `fetchWithTimeout` from `fetch-utils`
   - calling `window.fetch(\`${API_BASE}/api/...\`)`
   - importing `loginToVTOP` / `loginToEventHub`
   This enforces the "only the engine syncs" rule going forward.

## Phase 1 — Centralize the official sync (Main.tsx + data-fetchers)
- Port every `data-fetchers.ts` function into `operations/*` as registered ops.
- Rewrite `Main.tsx` `handleLogin`/`handleReloadRequest`/`fetchTransportData` to call `engine.login` + `engine.syncAll` / `engine.sync(name)`, wiring `engine.subscribe` to the existing progress UI. `Main.tsx` still holds the canonical state via atoms (read through `useSync`), but no longer calls `fetch` directly.
- Cutover is internal; UI unchanged. Verify build + manual login/reload.

## Phase 2 — Migrate components domain by domain
For each domain in `01-current-state.md`, replace the component's direct `fetch`/`loginToVTOP`/`loginToEventHub` with `useSync(name)` (read atom; call `sync()` on user action). Remove `API_BASE` imports. Group into small PRs:

- **Academic**: `Dashboard.tsx` (4× loginToVTOP + all-grades/calendar/grades/hostel/lms-data), `CoursePageTab.tsx`, `CourseDashboard.tsx`, `CurriculumPage.tsx`, `CircularsTab.tsx`.
- **Payments/Profile**: `PaymentsTab.tsx`, `ProfilePage.tsx` (credentials/student/registration-schedule/change-password), `ProfileStatusCards.tsx`, `AcknowledgementCards.tsx`, `FeedbackStatusModal.tsx`.
- **Events/Clubs**: `EventHubTab.tsx`, `EventHubSubpage.tsx`, `CommunityFeed.tsx`, `ClubHubTab.tsx`, `ClubDetailsModal.tsx`.
- **Library**: `LibrariesTab.tsx`.
- **Transport**: `TransportRegistration.tsx`, `MobileHome.tsx` (remove `API_BASE` import).
- **Notifications**: `pushNotificationManager.tsx`, `PushPromptModal.tsx`, `AmazeOnboardingFlow.tsx`.
- **Misc**: `mobilde/MobileHome`, any remaining `API_BASE` usages (grep after each phase).

Each PR must pass the Phase 0 lint guard.

## Phase 3 — Cleanup & enforcement
- Delete `auth.ts`, `event-hub.ts`, `data-fetchers.ts` (logic now in engine). Keep `fetch-utils.ts` (used only by `RequestLayer`).
- Remove the now-unused `useState` setters in `Main.tsx` that duplicate atoms.
- Add a store-level test: assert `StateBridge` is the only writer (e.g., a dev-time proxy on `storage` setters that throws if called outside `state-bridge.ts`).

## Rollback
- The engine is additive; `Main.tsx` cutover (Phase 1) is the only risky step. Keep `data-fetchers.ts` intact until Phase 3 so we can revert Phase 1/2 by pointing `Main.tsx` back at it.
- Each component PR is independently revertible.

## Definition of done
- `grep` for `API_BASE` in `src/components` returns nothing (except the engine).
- `grep` for `loginToVTOP|loginToEventHub` outside `src/lib/sync-engine` returns nothing.
- A wrong password produces exactly **one** `/api/login` attempt, then the engine gives up and surfaces "Edit credentials".
- No tab remount triggers a duplicate login for already-cached sessions.
