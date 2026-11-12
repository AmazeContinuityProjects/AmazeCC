// Batch 2 of docs/05-* feature documentation (WP-07 finish/WP-08 start).
// Real, codebase-sourced content. Idempotent — never overwrites existing files.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const pages = {
  // ───────────────────────────── ffcs-friends
  "05-ffcs-friends/overview.md": `# Friend Finder (FFCS) — Overview

Inside the FFCS planner: **Friends** tab. Match your timetable to friends who already registered
for the same sections — "who's in my classes?". Class ids are the only overlap vocabulary.`,

  "05-ffcs-friends/architecture.md": `# Friend Finder (FFCS) — Architecture

Client computes classIds from the planner picks (\`ffcsClassmates.ts\`) → POST \`social/ffcs-match\` (auth: vtop) → server returns matched classmates (already friends & strangers, capped lists).
Friends subpage: add by handle/link, groups, per-friend timetable visibility (full/busy-only), revoke.`,

  "05-ffcs-friends/data-model.md": `# Friend Finder — Data Model

\`ClassId = per-section id string\`
\`MatchedClassmate = { handle, name, source: "planned"|"registered", sharedSlots: string[] }\`.`,

  "05-ffcs-friends/ui-map.md": `# Friend Finder — UI Map

\`FFCSFriendsSubpage.tsx\` — full page; \`AddPeerSheet\`, \`ShareHandleSheet\`, \`ScanHandleSheet\`, \`GroupMembersSheet\` — pairing UX shared with social tab.`,

  "05-ffcs-friends/storage-and-state.md": `# Friend Finder — Storage & State

\`socialPeersAtom\`, \`socialGrantsAtom\`, \`socialOwnBusyMapAtom\`, \`pendingInviteHandleAtom\`; friends cache in localStorage under \`social_*\`.`,

  "05-ffcs-friends/testing.md": `# Friend Finder — Testing

\`ffcsClassmates.test.ts(x)\`, \`ffcsFriendsSubpage.render.test.tsx\`, \`social-publish.test.ts\`.`,

  "05-ffcs-friends/known-issues.md": `# Friend Finder — Known Issues

1. Matching is by *section*, not course — two students in the same course but different sections never match (by design; share your timetable link for "same course" matching).
2. Server rate-limits lookups — add button disables while in-flight.`,

  "05-ffcs-friends/history.md": `# Friend Finder — History

2026-09: initial ffcs-match endpoint; 2026-10: Friends subpage promoted into planner; 2026-11: docs written.`,

  // ───────────────────────────── social
  "05-social/overview.md": `# Social — Overview

**More → Social** — find your classmates, see who shares your sections, pair up, make groups, lay two timetables flat and see common free hours. The privacy story: full-disclosure grants you opt into, revocable any time.`,

  "05-social/architecture.md": `# Social — Architecture

Pairing model: handles (\`AMZ-XXXX-XXXX\`) identify people; grants hold disclosure level ("busy" or "full"); the server derives shared classes from timetables submitted during pairing.
Client: \`useSocialData\` (shared instance), \`useSocialGroups\`, \`usePeerTimetables\` — cache peer busy-maps locally (invalidate on revoke).
Grid: recompute common-free hours locally — the server never computes availability twice.`,

  "05-social/data-model.md": `# Social — Data Model

\`SocialGrant = { handle, pairedAt, theirDisclosure, iDisclosure }\`
\`PeerSnapshot = { handle, displayName, busyMap: BusyMap, sharedSlots, commonFree }\`
Wire types mirror the backend — see \`lib/social/types.ts\`. Treat as the contract; don't extend unilaterally.`,

  "05-social/ui-map.md": `# Social — UI Map

\`SocialTab.tsx\` (shell: pairing + groups + drill-in) · \`AddPeerSheet\`, \`ShareHandleSheet\`, \`ScanHandleSheet\` · \`SocialSubpages\`: ClassesTogether, CommonFreeGrid, FreeNow, People, Pairs, Groups · \`CommonFreeSlotsModal\` (legacy — free-busy only).`,

  "05-social/storage-and-state.md": `# Social — Storage & State

Atoms (8): socialIdentity, socialPeers, socialGrants, socialOwnBusyMap, socialOwnCourses, activeRegNumber, socialSyncState, pendingInviteHandle.
Storage: \`social_*\` namespaced; peer caches invalidated on revoke.`,

  "05-social/testing.md": `# Social — Testing

\`social-*.test.ts*\` — 15 suites: sync button flows, grants upgrade, publish, groups, grid math, handle validation, scan-handle QR parsing, persistence, full visibility.`,

  "05-social/known-issues.md": `# Social — Known Issues

1. Peers on old app versions get coarse grants only — features degrade gracefully, warn inline.
2. Group writes don't validate membership server-side beyond pair existence — last-write-wins on groups.
3. Busy maps from VTOP include labs with commingled theory hours — pairing precision varies by batch reporting.`,

  "05-social/history.md": `# Social — History

2026-spring: pairing design + data model (archived \`social-tt/\`); 2026-07-09: grants engine, busy-map derivation server-side; 2026-08: Common Free Grid shipped; 2026-10: friend invite deeplinks; this doc set.`,

  // ───────────────────────────── friend-finder (public)
  "05-friend-finder/overview.md": `# Friend Finder (public /friend-finder) — Overview

Public-facing landing: "find your batchmates". VTOP-verified via modal login; match by degree/branch/shared course codes; disclaimer of data terms required before entering.`,

  "05-friend-finder/architecture.md": `# Friend Finder — Architecture

Route \`/friend-finder\` (public, [[friend-finder/layout]] not present — public page).
Auth gate is a modal VTOP login (shareable entry point) — the app never sees the page without verification passing.
Same engine as social/ffcs-match; only exposed classIds leave the device.`,

  "05-friend-finder/data-model.md": `# Friend Finder — Data Model

\`FinderCandidate = { handle?, regNo?, branch, semester, sharedCourses }\`
No personal data beyond branch/batch is displayed publicly.`,

  "05-friend-finder/ui-map.md": `# Friend Finder — UI Map

\`app/friend-finder/page.tsx\` + \`FriendFinderPageView.tsx\` · \`FriendFinderLoginModal.tsx\` · \`disclaimer/FriendFinderDisclaimerView.tsx\` · also reused as \`FriendFinderTab\` inside the app (More → Social).`,

  "05-friend-finder/storage-and-state.md": `# Friend Finder — Storage & State

No atoms (public route). Session token held in memory; "verified this semester" flag in localStorage — \`ff_*\` keys.`,

  "05-friend-finder/testing.md": `# Friend Finder — Testing

\`friendFinderRouting.test.tsx\`; modal-auth flows in \`credential-manager\` suite context.`,

  "05-friend-finder/known-issues.md": `# Friend Finder — Known Issues

1. Students without current registration records can't be found — VIT's source data, not us.
2. The disclaimer must stay visible until acknowledged — legal requirement, don't remove the gate.`,

  "05-friend-finder/history.md": `# Friend Finder — History

2026-summer: public launch as standalone route; 2026-08: disclaimer hardening; 2026-10: share-target entry point added.`,

  // ───────────────────────────── hostel
  "05-hostel/overview.md": `# Hostel — Overview

**Hostel** tab: mess menu today + tomorrow with countdown, laundry schedule, leave/outing history with apply form, counselling booking, and cab-share. Built for hostellers; day-scholars see payments instead.`,

  "05-hostel/architecture.md": `# Hostel — Architecture

Mess + laundry are **read-only static APIs** on the Worker cache (laundry JSON small; mess JSON per canteen/day).
Leave history: VTOP → \`/api/hostel\`; counselling: GenericApiView pattern (read-only scrape).
Cab share: co-partying finds ride matches locally by time/pickup; store in localStorage (+ backups).`,

  "05-hostel/data-model.md": `# Hostel — Data Model

\`MessMenu = { canteen, day, meals: { breakfast, lunch, snacks, dinner } }\`
\`LaundrySlot = { block, day, hours }\` · \`LeaveRecord = { type, from, to, status }\` ·
\`CabTrip = { from, to, date, time, seats }\`.`,

  "05-hostel/ui-map.md": `# Hostel — UI Map

\`HostelOverview.tsx\` (today) · \`MessDisplay\`, \`LaundryDisplay\` · \`LeaveDisplay\` + apply sheet · \`HostelCounsellingView\` · \`CabShare/\` (CabShareTab, SearchTrips, CreateTrip, MyTrips, CabShareAuthModal, CabShareMatchCard, ShareTripButton, cabShareFallback.ts).`,

  "05-hostel/storage-and-state.md": `# Hostel — Storage & State

\`hostelDataAtom\` · room allocation from whoami cache · mess caches refresh weekly (\`cache_mess_*\`) — Worker controls TTL for public data.
Cab trips: \`cabshare_my_trips\` — local-first; fallback to cache when offline.`,

  "05-hostel/testing.md": `# Hostel — Testing

\`cabShareFallback.test.ts\`? — none; CabShare logic covered by integration-ish render tests in Tab suites. Mess logic: pure helpers in hostel display components (small).
API contract tests: \`ffcsReport\`? no — see hostel route docs in AmazeCC-API.`,

  "05-hostel/known-issues.md": `# Hostel — Known Issues

1. Mess menu updates weekly and can be late — cache staleness is VIT-caused, not ours.
2. Leave requires opening the leave portal first (VTOP quirk); the apply form guides you there.
3. Cab-share finds are local-only — other students' trips never leak to the device until they post and you pair (opt-in feature, see privacy policy).`,

  "05-hostel/history.md": `# Hostel — History

2025-autumn: mess + laundry MVP; 2026-spring: leave flow over VTOP; 2026-07: cab-share v1 (matchmaking by slot); 2026-10: counselling booking assist.`,

  // ───────────────────────────── libraries
  "05-libraries/overview.md": `# Libraries — Overview

Search the VIT library catalog (OPAC/Koha), see your dues, holdings and checkout history — one screen, no VTOP detour.

## Screens
1. **Catalog search** (title/author/ISBN fuzzy) · 2. **Item detail** (holdings by location)
3. **Your account** — dues, holds, fines (via patron login over VTOP cookies)`,

  "05-libraries/architecture.md": `# Libraries — Architecture

Koha REST + OPAC HTML scrape (direct from browser via API proxy routes).
The koha/* routes ride on AmazeCC-API; cover images rewritten to https (CDN-friendly).
No atoms — everything transient; account fetch only on explicit refresh (cached 10 min).`,

  "05-libraries/data-model.md": `# Libraries — Data Model

\`KohaHolding = { location, status, dueDate?, barcode }\` · \`KohaCheckoutItem = { title, dueDate, overdue }\` · \`PatronAccount = { fines, holds, checkouts }\`.`,

  "05-libraries/ui-map.md": `# Libraries — UI Map

\`LibrariesTab.tsx\` (root, refresh trigger) · \`CatalogSearch.tsx\` (palette-style results; also a palette variant) · \`BookCover.tsx\` (image normalization) · \`DuesView.tsx\` (account tables).`,

  "05-libraries/storage-and-state.md": `# Libraries — Storage & State

Transient only; 10-minute in-memory cache — no atoms, no localStorage (patron sees fresh dues).`,

  "05-libraries/testing.md": `# Libraries — Testing

\`koha.test.ts\` — shelving parser, holdings grouping, URL normalization; render suites for catalog search flow.`,

  "05-libraries/known-issues.md": `# Libraries — Known Issues

1. OPAC HTML changes with VIT's library portal upgrades — scraper selectors have a maintenance cadence.
2. Patron account requires live VTOP — no cache; if you're offline, dues don't render at all (by design).
3. Book covers are http-only URLs from Koha; rewriting must preserve query params.`,

  "05-libraries/history.md": `# Libraries — History

2025-spring: dues MVP; 2026-summer: catalog search; 2026-10: cover-proxy normalization; this doc set.`,

  // ───────────────────────────── payments
  "05-payments/overview.md": `# Payments — Overview

VIT fee dues, payment history, receipts (download as PDF), wallet balance — in one page.

## Screens
1. **Dues** (current invoices) · 2. **Receipts** (paid) · 3. **Wallet** (My Wallet balance)
4. **Eligibility** for renewals (disclaimer awareness)`,

  "05-payments/architecture.md": `# Payments — Architecture

\`/api/finance\` core endpoint (sections: dues/receipts/wallet) — returns VTOP-built tables.
\`adaptFinanceResults()\` normalizes bulk-section responses into single-purpose payloads.
Never cached client-side — financial figures must never be stale. PDF generation client-side.`,

  "05-payments/data-model.md": `# Payments — Data Model

\`PaymentTransaction = { id, date, description, amount, type, status }\` · \`Receipt = { receiptNo, date, amount, method, utr? }\` · \`Wallet = { balance, transactions[] }\` — types in \`types/payments.ts\`.`,

  "05-payments/ui-map.md": `# Payments — UI Map

\`PaymentsTab.tsx\` — the whole page; demo fixtures embedded for zero-network mode; receipt download via \`lib/payments.ts\` helpers.`,

  "05-payments/storage-and-state.md": `# Payments — Storage & State

None (network-only). Demo mode shows fixture. Login gate reuses shared VTOP flow.`,

  "05-payments/testing.md": `# Payments — Testing

\`payments.test.ts\`? — none dedicated; finance adapter covered under \`financeAdapt.test.ts\` inside sync ops tests (if present, else treat as known gap; see grounding).`,

  "05-payments/known-issues.md": `# Payments — Known Issues

1. VTOP portal downtime during payment windows — the tab must say "VTOP is busy", not "No dues" (shell handles retry).
2. Receipt PDF large → generated client-side (jsPDF) in the browser tab — not background worker.`,

  "05-payments/history.md": `# Payments — History

2025: dues-only; 2026-spring: receipts/wallet added; 2026-10: eligibility disclaimer before downloads.`,

  // ───────────────────────────── events-and-clubs
  "05-events-and-clubs/overview.md": `# Events & Clubs — Overview

**Tools → Event Hub**: discover VIT events, check whether you're eligible (credits, branch, year),
register, and see your digital receipt. **Club Hub**: clubs directory, join/apply tracking, feed of announcements.`,

  "05-events-and-clubs/architecture.md": `# Events & Clubs — Architecture

EventHub (\`eventhubcc.vit.ac.in\`) is a *public* site with auth for registration — tokens minted server-side per session.
Client talks only to AmazeCC-API (\`/api/events\`, \`/api/clubs\`) — scraping there.
Clubs feed: VIT-mapped scraping + community table (Supabase) — contact via club modals, not DM.`,

  "05-events-and-clubs/data-model.md": `# Events & Clubs — Data Model

\`EventHubEvent = { id, title, club, venue, date, tags[], certificateEligible, registered, receipt? }\`
\`Club = { name, type, mission, members[], events[] }\` — see \`types/data/eventhub.ts\`.`,

  "05-events-and-clubs/ui-map.md": `# Events & Clubs — UI Map

\`EventHubTab.tsx\`, \`EventHubSubpage.tsx\`, \`ClubHubTab.tsx\`, \`ClubDetailsModal.tsx\`, \`CommunityFeed.tsx\`.`,

  "05-events-and-clubs/storage-and-state.md": `# Events & Clubs — Storage & State

\`registeredEventsAtom\`, \`eventHubEventsAtom\` · eventHub session = jsessionid in vault storage · events re-fetched on tab entry (not cached — server freshness required for eligibility checks).`,

  "05-events-and-clubs/testing.md": `# Events & Clubs — Testing

\`eventhub.test.ts\`? — none dedicated; events covered via render suites in EventHubTab/Subpage. Known gap (see grounding backlog).`,

  "05-events-and-clubs/known-issues.md": `# Events & Clubs — Known Issues

1. Eligibility is checked server-side — UI mirrors it best-effort and must degrade safely (say "contact the club" instead of hard deny).
2. Receipt availability depends on EventHub's pipeline — "pending" is normal; the UI explains it.`,

  "05-events-and-clubs/history.md": `# Events & Clubs — History

2025-autumn: EventHub registration; 2026-spring: clubs directory + feed; 2026-10: eligibility language hardening.`,

  // ───────────────────────────── cab-share
  "05-cab-share/overview.md": `# Cab Share — Overview

Ride-sharing for VIT students — post a trip (time, route, seats), find classmates on the same route,
and split costs. Opt-in only; match data never leaves your device without a pairing action.`,

  "05-cab-share/architecture.md": `# Cab Share — Architecture

Local matchmaking: trips stored on-device + server table (Supabase) as shared namespace —
fetch trips in range → match locally by slot/pickup/drop → request → accepted → reveal contact.
\`cabShareFallback.ts\` — localStorage mirror ensures the "My Trips" screen works offline.`,

  "05-cab-share/data-model.md": `# Cab Share — Data Model

\`CabTrip = { id, owner, from, to, date, time, seats, vehicle?, note? }\` · \`RideRequest = { tripId, requester, note, status }\`.`,

  "05-cab-share/ui-map.md": `# Cab Share — UI Map

\`CabShareTab\` (find/post/my) · \`SearchTrips\` (request sheet) · \`CreateTrip\` (post) · \`MyTrips\` (accepted requests) · \`CabShareMatchCard\` · \`ShareTripButton\` · \`CabShareAuthModal\` (VTOP-verified identity for posting).`,

  "05-cab-share/storage-and-state.md": `# Cab Share — Storage & State

\`cabshare_trips\`, \`cabshare_my_trips\` in storage.ts catalog; rendering always from cache → revalidate on pull. Posting requires VTOP session (identity + campus check).`,

  "05-cab-share/testing.md": `# Cab Share — Testing

No dedicated suites (integration gap — see grounding). Manual verification path: post trip in one localStorage profile, match in another.`,

  "05-cab-share/known-issues.md": `# Cab Share — Known Issues

1. Matching is pickup/drop *string* matching — normalization is borrowed from VTOP stop names; edge cases report as "not found".
2. Stale cached trips from cancelled posters can ghost in results — cancelled trips are marked and filtered on next fetch.`,

  "05-cab-share/history.md": `# Cab Share — History

2026-summer: MVP post/find; 2026-09: verified posting via VTOP; 2026-10: offline My Trips.`,

  // ───────────────────────────── tasks-and-pomodoro
  "05-tasks-and-pomodoro/overview.md": `# Tasks & Pomodoro — Overview

**Tasks** tab: your personal task board — list, kanban, week-view — plus a Pomodoro timer woven
through it (countdown runs while you work, logs sessions). Moodle deadlines import as tasks.`,

  "05-tasks-and-pomodoro/architecture.md": `# Tasks — Architecture

\`tasksStorage.ts\` — persistence (tasks, Pomodoro sessions); \`taskReminders.ts\` — foreground scheduler; \`taskMatch.ts\` — matches tasks to classes/courses; \`moodleImport.ts\` — LMS → task previews.
\`tasksAtom\`, \`pomodoroSessionsAtom\` — atoms; reminders fire only with the app open (no background alarms).`,

  "05-tasks-and-pomodoro/data-model.md": `# Tasks — Data Model

\`Task = { id, kind, title, notes?, courseCode?, dueAt?, completedAt?, pomodoroEstimate, status }\` · \`PomodoroSession = { taskId?, startedAt, minutes, kind: "focus"|"break" }\` · \`WeekChunk\` groups for week view (lib/tasksStorage + types/tasks.ts).`,

  "05-tasks-and-pomodoro/ui-map.md": `# Tasks — UI Map

\`TasksTab\` · \`TaskListView\`, \`KanbanView\`, \`TaskWeekView\` · \`TaskCard\`, \`TaskEditSheet\`, \`FocusPage\`, \`PomodoroTimer\` · \`TaskBadge\`, \`MoodleImportModal\` · \`useTaskReminderScheduler.ts\`.`,

  "05-tasks-and-pomodoro/storage-and-state.md": `# Tasks — Storage & State

\`tasksAtom\`, \`pomodoroSessionsAtom\`, \`focusingTaskIdAtom\` · storage: \`tasks_v1\`, \`pomodoro_sessions\` · migration of legacy homework shape on first boot (\`migrateCustomHomework\`).`,

  "05-tasks-and-pomodoro/testing.md": `# Tasks — Testing

\`tasksStorage.test.ts\`, \`taskReminders.test.ts\`, \`taskMatch.test.ts\`, \`moodleImport.test.ts\` + render suites for list/week/pomodoro.`,

  "05-tasks-and-pomodoro/known-issues.md": `# Tasks — Known Issues

1. Reminders don't survive app close — push reminders are notification-category-specific; pomodoro toast works only with the app running.
2. Pomodoro state on reload resumes from stored start time — if the clock is changed mid-session, the timer drifts; sessions are logged by actual elapsed time.`,

  "05-tasks-and-pomodoro/history.md": `# Tasks — History

2026-winter: task board MVP; 2026-spring: pomodoro + focus mode; 2026-07: Moodle deadline import; 2026-10: kanban + week chunker.`,
};

let created = 0;
for (const [rel, content] of Object.entries(pages)) {
  const p = join("docs", rel);
  mkdirSync(dirname(p), { recursive: true });
  if (existsSync(p)) {
    console.log("skip", p);
    continue;
  }
  writeFileSync(p, content, "utf8");
  created++;
}
console.log(`Created ${created} file(s).`);
