# Sync Engine — API Reference (proposed)

## Public hook (what components use)
```ts
import { useSync } from "@/hooks/useSync";

function PaymentsTab() {
  const { data: payments, status, sync, editCredentials } = useSync("payments");
  // data  -> from the atom (always fresh; engine populates it)
  // status-> { phase, message, error }
  // sync() -> trigger a (coalesced) refresh of "payments"
  // editCredentials -> opens the credential editor (see 05)
}
```
`useSync(name?)`:
- no arg → returns `{ syncAll, login, logout, editCredentials, subscribe, status }`.
- with `name` → also returns `data` (the atom for that op) and a scoped `sync()`.

## SyncEngine methods
```ts
engine.login(ids: Ids): Promise<void>
engine.editCredentials(nextIds: Ids): Promise<void>
engine.logout(): Promise<void>
engine.sync(name: string, opts?: { force?: boolean }): Promise<void>
engine.syncAll(opts?: { force?: boolean; backgroundOnly?: boolean }): Promise<void>
engine.invalidate(name?: string): Promise<void>
engine.subscribe(cb: (e: ProgressEvent) => void): () => void
```

## Operation registry (initial set)
Names map 1:1 to a data domain. Each is implemented once in `operations/*`.

| name | auth | current source |
|------|------|----------------|
| `attendance` | vtop | `fetchAttendanceAndMarks` (attendance) |
| `marks` | vtop | `fetchAttendanceAndMarks` (marks) |
| `core` | vtop | `fetchCoreData` (grades/schedule/hostel/calendar/allGrades/profileImages) — kept as one op for ordering |
| `studentProfile` | vtop | `fetchStudentProfile` |
| `pastAttendance` | vtop | `fetchPastAttendance` (depends on `core`) |
| `fresher` | vtop | `fetchFresherData` (ept-schedule, acknowledgement) |
| `buses` | none | `fetchBusRoutes` / `transport` |
| `transport` | vtop | `fetchTransportData` |
| `events` | eventhub+none | `fetchEventData` (registered + public) |
| `eventHubProfile` | eventhub | `events/profile` |
| `bulk` | vtop | `fetchBulkEndpoints` (exc-registration, minor-honour, course-completion, credentials, registration-schedule, dayboarder, bank-info, library-due, hostel-counselling, payments, payment-receipts, wallet) |
| `payments` | vtop | `PaymentsTab` direct fetch |
| `library` | none | `LibrariesTab` koha search/detail/patron |
| `clubs` | none | `ClubHubTab`/`ClubDetailsModal`/`CommunityFeed` |
| `coursePage` | vtop | `CoursePageTab`/`CourseDashboard` |
| `curriculum` | vtop | `CurriculumPage` |
| `circulars` | vtop | `CircularsTab` |
| `feedback` | vtop | `FeedbackStatusModal` |
| `notifications` | none | `pushNotificationManager`/`PushPromptModal`/`onboarding` |
| `lms` | vtop | `lms-data` |
| `acknowledgement` | vtop | `AcknowledgementCards` |
| `profileStatus` | vtop | `ProfileStatusCards` (ept/registration/bank/dayboarder/credentials/apaarid) |
| `changePassword` | vtop | `ProfilePage` `change-password` (VTOP password change, distinct from `editCredentials`) |

## Types
```ts
type SyncPhase = "idle" | "start" | "done" | "error";
interface ProgressEvent { op: string; phase: SyncPhase; message?: string; delta?: number; error?: EngineError; }
type EngineError =
  | { kind: "auth"; domain: "vtop" | "eventhub"; message: string }
  | { kind: "transient"; message: string; retryAfterMs: number }
  | { kind: "notFound"; message: string }
  | { kind: "aborted" }
  | { kind: "unknown"; message: string };
```

## Atoms the engine writes (via StateBridge)
Reuse the existing `dataAtoms.ts` atoms (`attendanceDataAtom`, `marksDataAtom`, `gradesDataAtom`, `allGradesDataAtom`, `scheduleDataAtom`, `hostelDataAtom`, `calendarDataAtom`, `registeredEventsAtom`, `eventHubEventsAtom`, …) plus new ones for `paymentsAtom`, `libraryAtom`, `clubsAtom`, `coursePageAtom`, `circularsAtom`, `feedbackAtom`, `profileStatusAtom`, `lmsAtom`, `transportAtom`, `busesAtom`. `storage` keys are unchanged (defined in `storage.ts`).
