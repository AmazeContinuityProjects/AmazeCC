# Sync Engine — Current State Inventory

This document maps exactly where sync happens today, so the migration has a clear checklist.

## The "official" sync (to be absorbed into the engine)
- `src/lib/data-fetchers.ts` — `fetchAttendanceAndMarks`, `fetchCoreData`, `fetchEventData`, `fetchStudentProfile`, `fetchPastAttendance`, `fetchFresherData`, `fetchBusRoutes`, `fetchBulkEndpoints`. Each posts to `/api/...` with raw cookies; several write `storage.*` directly.
- `src/components/custom/Main.tsx`
  - `loginToVTOP` (delegates to `auth.ts`)
  - `handleLogin` → `fetchAttendanceAndMarks` + `fetchStudentProfile` + `fetchCoreData`, then background: `fetchEventData`, `fetchPastAttendance`, `fetchFresherData`, `fetchBusRoutes`, `fetchBulkEndpoints`.
  - `fetchTransportData` → direct `fetch(${API_BASE}/api/transport)`.
  - `handleReloadRequest` → direct `fetch` for attendance/marks/events/transport/lms-data/ept-schedule/acknowledgement/buses/library-due/bulk endpoints.
  - Holds the canonical `useState` for all data and passes setters down to ~30 children.

## Login managers (to be merged into CredentialManager)
- `src/lib/auth.ts` — `loginToVTOP` (VTOP). Has `cachedVTOPCredentials`, `globalLoginPromise` dedup, and a recently-added `failedLogin` give-up cache.
- `src/lib/event-hub.ts` — `loginToEventHub` (EventHub). Has `cachedEventHubSession`, `globalEventHubLoginPromise` dedup. **No give-up / backoff.**

## Components that fetch DIRECTLY (must be migrated to the engine)
Each line below is a direct `fetch(\`${API_BASE}/api/...\`)` or a `loginToVTOP()`/`loginToEventHub()` call outside `Main.tsx`/`data-fetchers.ts`. These are the scattered sites that cause duplicate logins and untracked requests.

| File | Endpoints / calls |
|------|-------------------|
| `app/pushNotificationManager.tsx` | `notifications/subscribe`, `notifications/unsubscribe` |
| `components/custom/dayscholar/TransportRegistration.tsx` | `transport/track` |
| `components/custom/Dashboard.tsx` | `fresher-resources`, `buses`, `all-grades`, `calendar`, `grades`, `hostel`, `lms-data` (4× `loginToVTOP()`) |
| `components/custom/more/CommunityFeed.tsx` | `club-admin/feed`, `events`, `club-admin/feed/promote` |
| `components/custom/more/ClubHubTab.tsx` | `clubs/details`, `club-enrollment` |
| `components/custom/more/ClubDetailsModal.tsx` | `club-admin/landing-page` |
| `components/custom/PushPromptModal.tsx` | `notifications/subscribe` |
| `components/custom/mobile/MobileHome.tsx` | imports `API_BASE` (used in sub-components) |
| `components/custom/header/ProfilePage.tsx` | `change-password`, `credentials`, `student`, `registration-schedule`, `api/${endpoint}` (multiple) |
| `components/custom/profile/ProfileStatusCards.tsx` | `ept-schedule`, `registration-schedule`, `bank-info`, `dayboarder`, `credentials`, `apaarid` |
| `components/custom/profile/FeedbackStatusModal.tsx` | `feedback-status` |
| `components/custom/libraries/LibrariesTab.tsx` | `koha/search`, `koha/detail`, `koha/patron` |
| `components/custom/profile/AcknowledgementCards.tsx` | `acknowledgement` |
| `components/custom/PaymentsTab.tsx` | `api/${endpoint}` (payments/wallet/receipts) |
| `components/custom/events/EventHubTab.tsx` | `events`, `events/preview`, `events/profile`, `loginToEventHub` |
| `components/custom/events/EventHubSubpage.tsx` | `clubs/details`, `events/download`, `events/register`, `events/paynow`, `loginToEventHub` |
| `components/custom/exams/CoursePageTab.tsx` | `course-page` |
| `components/custom/onboarding/AmazeOnboardingFlow.tsx` | `notifications/subscribe` |
| `components/custom/exams/CourseDashboard.tsx` | `marks/stats`, `course-page`, `qcm-view` |
| `components/custom/exams/CircularsTab.tsx` | `circulars/download`, `circulars` |
| `components/custom/exams/CurriculumPage.tsx` | `curriculum`, `curriculum/syllabus`, `loginToVTOP` |

(Plus any others surfaced by grepping `API_BASE` / `fetchWithTimeout` / `loginToVTOP` / `loginToEventHub` during migration.)

## State written from many places
- `src/lib/storage.ts` — persistence keys (attendance, marks, grades, allGrades, schedule, hostel, calendar, profile, profileImages, registeredEvents, transportData, cache_*, frozen_att_*, etc.).
- `src/components/custom/Main.tsx` — ~20 `useState` setters (`setAttendanceData`, `setMarksData`, …) updated from both `handleLogin` and child callbacks.
- `src/store/dataAtoms.ts` — atoms (`attendanceDataAtom`, `marksDataAtom`, …) some components read/write directly.
- `data-fetchers.ts` writes `storage.*` inside fetchers (e.g. `storage.grades.set`, `storage.profileImages.set`, `storage.cache.set`).

**Conclusion:** there is no single writer. The engine's `StateBridge` must become the only writer of both `storage` and the atoms.

## Concrete pain this causes (real bugs seen)
- Wrong password → every `loginToVTOP()` call re-POSTs `/api/login` (Dashboard alone calls it 4×; each mounted tab calls it again). VTOP sees a burst → lockout. (Mitigated partially by `failedLogin` cache in `auth.ts`, but only for VTOP and only after the first in-flight settles.)
- EventHub has **no** give-up at all (`event-hub.ts`), so a bad EventHub password loops on every EventHub-using screen.
- Navigating between tabs triggers fresh logins + fetches for already-cached data.
