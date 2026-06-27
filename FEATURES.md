# AmazeCC — Complete Feature Documentation

> **Version:** 2.1.0  
> **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + PostgreSQL  
> **Frontend:** AmazeCC (`:3001`)  
> **Backend/API:** AmazeCC-API (`:3000`)  
> **Admin Dashboard:** AmazeCC-Dashboard (`:3002`)  

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication & Login](#1-authentication--login)
3. [Dashboard & Navigation](#2-dashboard--navigation)
4. [Attendance Module](#3-attendance-module)
5. [Academics Hub](#4-academics-hub)
6. [Grades & All Grades](#5-grades--all-grades)
7. [Hostel Module](#6-hostel-module)
8. [Day Scholar Module](#7-day-scholar-module)
9. [Payments Module](#8-payments-module)
10. [Libraries Module](#9-libraries-module)
11. [More Tab (Social, Events, QBank)](#10-more-tab)
12. [Profile Tab](#11-profile-tab)
13. [Fresher Welcome & EPT](#12-fresher-welcome--ept)
14. [Command Palette (⌘K)](#13-command-palette-k)
15. [EventHub](#14-eventhub)
16. [Push Notifications](#15-push-notifications)
17. [Theme System](#16-theme-system)
18. [Service Worker & Offline](#17-service-worker--offline)
19. [Admin API Endpoints](#18-admin-api-endpoints)
20. [Public API Endpoints (130+)](#19-public-api-endpoints)
21. [Settings & Configuration](#20-settings--configuration)
22. [Build, Test & Deployment](#21-build-test--deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AmazeCC (Next.js 16)                     │
│  :3001                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Main.tsx (Entry Component)                         │   │
│  │  ├── LoginForm (VTOP/Moodle credentials)            │   │
│  │  ├── Dashboard.tsx (Main Dashboard Shell)           │   │
│  │  │   ├── NavigationTabs                             │   │
│  │  │   ├── StatsCards                                 │   │
│  │  │   ├── FresherWelcomePage                         │   │
│  │  │   └── Sub-tab content (conditional render)       │   │
│  │  └── CommandPalette (⌘K overlay)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  Communicates via: API_BASE env var (default: prod URL)    │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS / JSON
               ▼
┌─────────────────────────────────────────────────────────────┐
│              AmazeCC-API (Next.js 16 API Routes)            │
│  :3000                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ~130 POST endpoints (VTOP scraping proxy)          │   │
│  │  ~15  GET endpoints (public data, DB-backed)        │   │
│  │  ~10  Admin endpoints (admin auth required)         │   │
│  │  DB: PostgreSQL (Supabase or direct pool)           │   │
│  │  Auth: HMAC-SHA256 tokens, rate limiting            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack Details

**Frontend (AmazeCC):**
- Next.js 16 with App Router
- TypeScript 5.9
- Tailwind CSS v4 with `@tailwindcss/postcss`
- Framer Motion (animations)
- Radix UI primitives (Dialog, Dropdown, Popover, Tabs, etc.)
- lucide-react (icons)
- React Markdown (for markdown rendering)
- Recharts (charts)
- cmdk (command palette)
- Jotai (state management — available)
- serwist (Service Worker / PWA)
- next-themes (theme provider)
- html-to-image, jspdf (export)
- react-dropzone (file uploads)
- Swiper (carousel/slider)

**Backend (AmazeCC-API):**
- Next.js 16 API Routes
- PostgreSQL with `pg` (node-postgres)
- Cheerio (HTML scraping)
- Axios (HTTP client for VTOP)
- `tough-cookie` (cookie jar)
- `web-push` (push notifications)
- `canvas`, `nodemailer` (utilities)
- Swagger/OpenAPI docs via `/api/docs`

---

## 1. Authentication & Login

### 1.1 Login Flow (`Main.tsx`)

The login form captures VTOP credentials (username + password) and optionally Moodle credentials.

```
User submits → POST /api/login
              ├── Fetches captcha image from VTOP
              ├── Solves captcha via /api/login/captcha + solveCaptcha
              ├── POSTs to VTOP with username + password + captcha
              ├── Validates dashboard HTML response
              │   ├── "authorizedidx" found → success
              │   ├── "Invalid Captcha" → auto-retry with fresh captcha
              │   ├── "Invalid Username/Password" → auth failure
              │   └── "months" → password expired (must change on VTOP)
              └── Returns cookies + csrf + authorizedID
```

**Key implementation details:**
- Rate limited to 5 attempts per 60s per IP (`checkRateLimit` in `login/route.ts:49`)
- Captcha solving uses a custom solver (`solveCaptcha.ts`)
- Uses `VTOPClient()` — an Axios instance with cookie handling
- Login promise is cached in `loginPromise` to prevent concurrent logins (`Main.tsx:261-302`)
- 60-second fetch timeout with `AbortController` (`fetchWithTimeout`)

### 1.2 VTOPClient (`lib/clients/VTOPClient.ts`)

An Axios instance pre-configured with:
- Base URL: `https://vtop.vit.ac.in`
- SSL certificate verification disabled (self-signed cert)
- Cookie jar via `tough-cookie`
- Follows VTOP redirects manually

### 1.3 Session Persistence

Credentials are stored in `localStorage`:
- `username`, `password` — VTOP credentials
- `moodle_username`, `moodle_password` — Moodle/LMS credentials
- `IDs` — JSON object with `{ VtopUsername, VtopPassword, MoodleUsername, MoodlePassword }`

On app load, `Main.tsx:211-259` restores all cached data from localStorage.

### 1.4 Demo Mode

`Main.tsx:864-882` — Sets `demoMode=true`, loads fake data from `demoData.json`:
- Pre-populated attendance, marks, grades, schedule, hostel, calendar
- Useful for testing without live credentials

### 1.5 Logout

`Main.tsx:814-838` — `handleLogOutRequest`:
- Clears all localStorage EXCEPT `theme`, `activityTree`, `settings`
- Resets all state to defaults
- Keeps user preferences intact

---

## 2. Dashboard & Navigation

### 2.1 Dashboard Shell (`Dashboard.tsx`)

The main logged-in interface consists of:

```
┌──────────────────────────────────────────┐
│  NavigationTabs (top bar)                │
│  ┌──┬──────┬──────┬──┬──┬──┬──┬──┬──┐   │
│  │👤│ 📋att│📚acad│💳pay│📖lib│➕more│   │
│  └──┴──────┴──────┴──┴──┴──┴──┴──┴──┘   │
├──────────────────────────────────────────┤
│  StatsCards (mobile header)              │
│  ┌──────┬──────┬──────┬──────┐          │
│  │%att  │ CGPA  │marks │ OD    │          │
│  └──────┴──────┴──────┴──────┘          │
├──────────────────────────────────────────┤
│  Content Area (tab-dependent)            │
│  - Attendance (sub-tabs: attendance/     │
│    calendar/circulars)                    │
│  - Academics (sub-tabs: overview/        │
│    curriculum/timetable/grades/gpa/...)  │
│  - Hostel / Day Scholar                  │
│  - Payments / Libraries / More / Profile │
└──────────────────────────────────────────┘
```

### 2.2 Tab Ordering

`tabsOrder` = `["attendance", "academics", "payments", "libraries", "more", "profile"]`

- **Hostel** tab is conditionally inserted when `profileData?.isHosteller === true` or `residentialStatus === "hosteller"`
- **DayScholar** tab is inserted when `isHosteller === false` or `residentialStatus === "dayscholar"`

### 2.3 Touch Gesture Swipe

`Dashboard.tsx:207-247` — Horizontal swipe detection:
- Tracks touch start/end coordinates via refs
- Minimum threshold of 75px
- Swipe left → next tab, swipe right → previous tab
- Prevents swipe on scrollable elements, buttons, inputs

### 2.4 Ambient Background Glows

`Dashboard.tsx:510-513` — Fixed-position decorative blurs:
- Blue glow top-left
- Emerald glow bottom-right
- Opacity scales with theme (light/dark/midnight)

### 2.5 NavigationTabs Component

`header/NavigationTabs.tsx` — Desktop sidebar + mobile bottom nav:
- Icons from lucide-react
- Active tab highlighting
- Semester selector dropdown
- Reload button, logout
- Tabs shown conditionally based on hostel/dayscholar status

---

## 3. Attendance Module

### 3.1 AttendanceTabs (`attendance/attendanceTabs.tsx`)

Per-course attendance view with:
- Course cards showing: courseTitle, courseCode, slot/venue, total vs attended classes, percentage
- Color-coded percentage: Green (≥80%), Yellow (≥75%), Red (<75%)
- Expandable day-wise breakdown (`viewLink` array)
- On-duty (OD) tracking within attendance view
- Mobile detail subpage via `setIsSubpageOpen`

### 3.2 Attendance Sub-tabs

- **attendance** — Today's attendance overview + per-course details
- **calendar** — Academic calendar + events + moodle assignments overlay
- **circulars** — Circulars from VTOP

### 3.3 Calendar View (`attendance/CalendarView.tsx`)

Multi-layered calendar displaying:
- Academic calendar events per month (from VTOP)
- Each event has type (Holiday, Instructional Day, Exam Day, etc.)
- Moodle assignment deadlines
- Exam schedule dates
- On-duty dates
- Registered events
- Calendar type selector (ALL, ALL02, ALL03, ALL05, ALL06, ALL08, ALL11, WEI)

### 3.4 OD Hours Tracker

When attendance data is loaded/updated (`Main.tsx:125-208`):
- Scans all attendance records for "On Duty" entries
- Groups by date
- Calculates hours (Lab = 2h, Theory = 1h)
- Saves to `ODhoursData` state
- Also tracks "wasted" vs "recovered" ODs by comparing with previous localStorage snapshot

### 3.5 Attendance Predictor (`attendance/overallAttendancePredictor.tsx`)

Allows students to:
- See current attendance percentage per course
- Simulate "what if I miss N more classes"
- Calculate how many more classes to attend to reach 75%

### 3.6 CircularsTab

`Exams/CircularsTab.tsx` — Fetches and displays circulars from VTOP with:
- Title, date, description
- Downloadable attachments

---

## 4. Academics Hub

### 4.1 AcademicsHub (`Exams/AcademicsHub.tsx`)

Main academic overview showing:
- Current semester course list
- Marks summary per course
- Quick navigation to sub-tabs

### 4.2 CurriculumPage (`Exams/CurriculumPage.tsx`)

- Displays course curriculum (syllabus) fetched from VTOP
- Organized by course category/type
- Links to detailed syllabus PDFs

### 4.3 ScheduleDisplay (`Exams/ScheduleDisplay.tsx`)

Exam schedule with:
- Course code, title, date, session (FN/AN), venue, seat number
- Grouped by date/session
- Toggle for current semester

### 4.4 Sub-tabs Available

| Sub-tab | Component | Description |
|---------|-----------|-------------|
| `overview` | `AcademicsHub` | Semester overview with marks summary |
| `curriculum` | `CurriculumPage` | Course curriculum & syllabus |
| `timetable` | `ScheduleSubTab` | Exam schedule & timetable |
| `grades` | `TestGradesContainer` | All grades across semesters |
| `gpa` | `GPAPredictorTab` | GPA prediction tool |
| `course-dashboard` | `CourseDashboard` | Per-course deep dive |
| `circulars` | `CircularsTab` | Academic circulars |
| `faculty` | `FacultyInfoTab` | Faculty contact info |
| `qcm` | `QCMViewTab` | Question category mapping |
| `arrear` | `ArrearTab` | Arrear exam details |
| `makeup-compre` | `MakeupCompreTab` | Makeup compre info |
| `course-mgmt` | `CourseMgmtTab` | Course registration management |
| `projects` | `ProjectsTab` | Project submissions |
| `wishlist` | `WishlistTab` | Future course wishlist |

### 4.5 MarksDisplay (`Exams/MarksDisplay.tsx`)

Per-course marks breakdown:
- Assessment name, scored mark, max mark
- Weighted percentage calculation
- Color-coded performance (green ≥80%, yellow ≥60%, red <60%)

### 4.6 CourseDashboard (`Exams/CourseDashboard.tsx`)

Deep-dive into a single course:
- Combined attendance + marks view
- Faculty info
- Assessment timeline

---

## 5. Grades & All Grades

### 5.1 GradesModal (`Exams/GradesModal.tsx`)

Modal overlay showing:
- Current semester grades with course code, title, grade, total
- Grade color coding: S (green), A (blue), B (yellow), C (orange), F/N (red)
- Marks breakdown per assessment

### 5.2 AllGradesDisplay (`Exams/AllGradesDisplay.tsx`)

All semesters' grades in one view:
- Grouped by semester
- Per-course: grade, credits, GPA contribution
- Running CGPA calculation
- Overall CGPA display

### 5.3 GPAPredictorTab (`Exams/GPAPredictorTab.tsx`)

Predictive tool that:
- Shows current marks per course
- Allows inputting expected future marks
- Calculates predicted GPA and CGPA
- Shows what grade is needed in remaining assessments

### 5.4 Marks History (`Exams/MarksHistoryTab.tsx`)

Timeline view of marks across assessments for each course.

---

## 6. Hostel Module

### 6.1 HostelSubTabs (`Hostel/HostelSubsTab.tsx`)

- **mess** — MessDisplay: Weekly mess menu, mess feedback submission, mess selection changes
- **laundry** — LaundryDisplay: Laundry service status, slot booking
- **leave** — LeaveDisplay: Leave history, pending leaves, new leave application
- **counselling** — HostelCounsellingView: Wrapper for `GenericApiView` on `hostel-counselling` endpoint

### 6.2 MessDisplay (`Hostel/messDisplay.tsx`)

- Current mess menu (breakfast, lunch, snacks, dinner)
- Mess feedback form
- Mess selection change request

### 6.3 LaundryDisplay (`Hostel/LaundryDisplay.tsx`)

- Laundry booking status
- Slot availability
- Service history

### 6.4 LeaveDisplay (`Hostel/LeaveDisplay.tsx`)

- Table of leaves with reason, from/to dates, status
- Status color: Approved (green), Pending (yellow), Rejected (red)
- Reload button

---

## 7. Day Scholar Module

### 7.1 BusFinder (`dayscholar/BusFinder.tsx`)

- Search bus routes by stop name or route number
- Display bus stops with timings
- Route map (text-based)
- Cached bus data from `cache_buses` localStorage

### 7.2 Transport Registration (`dayscholar/TransportRegistration.tsx`)

- Transport service registration
- Checks if user already registered via `/api/transport`
- Auto-detects dayscholar-with-bus mode

---

## 8. Payments Module

### 8.1 PaymentsTab (`PaymentsTab.tsx`)

- Fee due summary
- Payment history
- Receipt downloads via `/api/payment-receipts`
- Wallet balance via `/api/wallet`
- Online payment transfer interface

### API Endpoints for Payments:
- `POST /api/payments` — Fee details and dues
- `POST /api/payment-receipts` — Downloadable receipt links
- `POST /api/wallet` — Wallet balance and transactions
- `POST /api/fees-intimation` — Fee intimation notices
- `POST /api/online-transfer` — Online payment transfer

---

## 9. Libraries Module

### 9.1 LibrariesTab (`Libraries/LibrariesTab.tsx`)

Comprehensive library management with three sub-tabs:

**Catalog Search:**
- KOHA library catalog integration via `/api/koha/search`
- Search by title, author, ISBN
- Book cover images, publisher info, availability
- Command palette integration (type `koha: <search term>`)

**Account (KOHA Patron):**
- Checked out books with due dates
- Fine/dues summary
- Library charges and payments
- KOHA login via `/api/koha/login` + patron pages via `/api/koha/patron`

**Library Services:**
- Library due amounts via `/api/library-due`
- Key requests via `/api/library-keys`
- Scanning services via `/api/library-scanning`
- Book recommendations via `/api/book-recommendation`

### KOHA Integration

Two separate authentication paths:
1. **Public search** (`/api/koha/search`) — Searches OPAC without auth
2. **Patron access** (`/api/koha/login` + `/api/koha/patron`) — Logs in with library credentials

Patron data includes:
- Checkouts: title, author, call number, due dates, renewals
- Charges: fines, payments, outstanding amounts
- Holds: reserved books status

---

## 10. More Tab

### 10.1 MoreTab (`more/MoreTab.tsx`)

Hub for miscellaneous features with sub-tabs:

### 10.2 Social Tab (`social/SocialTab.tsx`)

**Friend Management:**
- `AddFriendModal.tsx` — Add friends by username/code
- `AddGroupModal.tsx` — Create friend groups
- `CommonFreeSlotsModal.tsx` — Find common free time slots with friends
- `FriendTimetableModal.tsx` — View friend's timetable
- `ShareScheduleModal.tsx` — Share your schedule

**Social Features:**
- Common free slots grid (`CommonFreeSlotsGrid.tsx`)
- Friend list with timetables
- Group scheduling

### 10.3 Events Hub (`events/EventHubSubpage.tsx`)

- Registered events from VTOP
- Event posters/images
- Event details: date, time, venue, payment status
- EventHub event discovery (`EventHubTab.tsx`)

### 10.4 QBank (Question Bank)

**Papers Archive (`qbank/PapersArchiveTab.tsx`):**
- Previous year question papers
- Search by course code, title, year
- Download/view papers
- `UploadPaperModal.tsx` — Upload new papers

**Pure QBank (`qbank/PureQBankTab.tsx`):**
- Subject-wise question banks
- Questions grouped by topic
- `ExamQuestion.tsx` — Individual question display with LaTeX rendering

### 10.5 GenericApiView (`Exams/GenericApiView.tsx`)

A reusable component for any VTOP endpoint:
- Fetches data from an API endpoint
- Renders data in a table format
- Headers auto-detected from response
- Used by: hostel counselling, arrear details, course management, etc.

---

## 11. Profile Tab

### 11.1 ProfileTab (`profile/ProfileTab.tsx`)

Sub-tabs:
- **info** — Profile information display with `ProfileStatusCards.tsx`
- **settings** — App settings (same as command palette settings)
- **feedback** — `FeedbackStatusModal.tsx` for course feedback

### 11.2 ProfileInfo (`profile/ProfileStatusCards.tsx`)

- Registration number, name, email, mobile
- Program, campus, batch
- Profile image
- Academic status

### 11.3 ProfileSubTabs (`profile/ProfileSubTabs.tsx`)

- Personal info
- Academic info
- Contact details
- Documents & acknowledgements (`AcknowledgementCards.tsx`)

### 11.4 Settings (in profile)

- Friendly name
- Decimal values in attendance
- Hide CGPA
- Loading screen animation toggle
- Residential status (hosteller/dayscholar)
- Dayscholar bus mode
- Calendar type selector
- Semester selector
- Mobile header visibility
- Reload all data on refresh toggle

---

## 12. Fresher Welcome & EPT

### 12.1 FresherWelcomePage (`FresherWelcomePage.tsx`)

Full-screen welcome page for new students showing:

**Header:** Gradient background with university branding

**EPT Schedule:**
- Fetched from `/api/ept-schedule`
- Table with exam dates, sessions, subjects
- Key-value pairs (reporting time, venue instructions)

**Document Acknowledgement:**
- Fetched from `/api/acknowledgement`
- Document names with submission status
- Status badges: Submitted (green), Pending (gray)

**Helpful Resources:**
- Fetched from `/api/fresher-resources` (public, DB-backed)
- Three resource types:
  - **`link`** — Card with icon, title, description, external URL (opens in new tab)
  - **`text`** — Plain text content block (title + description + content)
  - **`md`** — Markdown-rendered guide (uses `react-markdown` with styled typography)
- Resources are managed via admin dashboard (AmazeCC-Dashboard)

### 12.2 Trigger Conditions

Currently, the FresherWelcomePage only shows in **demo mode** (`Dashboard.tsx:129-134`).  
For production, it would be triggered by:
- First-time login detection
- Presence of EPT schedule data (indicating a fresher)
- `hasFutureExam()` helper checks for future EPT dates

### 12.3 API Endpoints

- `GET /api/fresher-resources` — Public, returns active resources
- `POST /api/ept-schedule` — VTOP-scoped, returns EPT/placement test schedule
- `POST /api/acknowledgement` — VTOP-scoped, returns document acknowledgment status

---

## 13. Command Palette (⌘K)

### 13.1 CommandPalette Component (`shared/CommandPalette.tsx`)

A Spotlight/Alfred-style command palette triggered by `Cmd+K` or `Ctrl+K`.

**Features:**
- Fuzzy search across all commands (case-insensitive character sequence matching)
- Categorized results with sticky headers
- Keyboard navigation (↑↓ arrows, Enter to select, Escape to close)
- Mouse hover selection
- Detail panel below results for rich previews
- Responsive: full overlay on mobile, centered on desktop

### 13.2 Commands Generated (`Main.tsx:928-1733`)

The `cmds` array is built dynamically via `useMemo` with dozens of categories:

**Navigation (8 commands):**
- Profile, Attendance, Academics Hub, Payments, Libraries, Hostel, Day Scholar, More

**Academics Sub-tabs (14 commands):**
- Marks Overview, Curriculum, Timetable, Grade History, GPA Predictor, Course Dashboard, Circulars, Faculty Info, QCM View, Arrear Exams, Makeup Compre, Course Management, Projects, Wishlist

**Attendance Sub-tabs (3 commands):**
- Attendance Today, Calendar View, Attendance Circulars

**Per-Course Attendance (N commands — one per course + what-if scenarios):**
- Each course shows: name, code, percentage, classes attended/total
- "Miss N classes" what-if simulation (up to 5 scenarios per course)
- "Need to attend X more to reach 75%" recovery calculation
- Below-75% course warnings

**Per-Course Marks (N commands — one per course):**
- Assessment breakdown with scores
- Weighted percentage color-coded

**Grades (N commands):**
- All semesters, all courses with grade
- Current semester grades
- Grade color coding

**Events (N commands):**
- Registered events with poster previews
- EventHub discovered events

**Exam Schedule (N commands):**
- Every exam with date, session, venue, seat number

**Calendar Events (N commands):**
- Academic calendar events per month

**Hostel (N commands):**
- Hostel info (block, room, mess)
- Leave history entries

**LMS/Moodle Assignments (N commands):**
- Pending assignments with due dates
- Completed assignments
- Direct link to submission

**Library (N commands):**
- KOHA patron charges/fines
- Checked out books
- Library dues summary

**KOHA Catalog (10 commands — live search):**
- Type `koha: <query>` to search library catalog
- Shows cover image, author, publisher, ISBN
- Click to navigate to libraries tab

**Profile (1 command):**
- Registration number, name, program, campus

**Bus Routes (N commands):**
- Cached bus route info

**Tools (5 commands):**
- OD Hours Display, Grades Details Modal, GPA Predictor, Feedback Status, Reload All Data

**Settings (15+ commands):**
- Decimal Values, Hide CGPA, Loading Screen, Dayscholar Bus Mode
- Attendance Display Mode (percentage/fraction)
- Residential Status (hosteller/dayscholar)
- Calendar Type (ALL, ALL02, ... WEI)
- Semester Selection

### 13.3 KOHA Search Integration

When the user types `koha` in the command palette query:
1. Detect the "koha" keyword (`Main.tsx:912-926`)
2. Extract the search term after "koha:"
3. Debounce-fetch `/api/koha/search?q=<term>&count=10` with `AbortController`
4. Show results as command items with cover images, author, publisher
5. Loading/empty/error states handled

---

## 14. EventHub

### 14.1 EventHubTab (`events/EventHubTab.tsx`)

A section in the More tab for discovering events:

**Event Discovery:**
- Fetches from `GET /api/events` (public endpoint)
- Event cards with title, date, venue, price, eligibility
- Poster/preview images via `EventPreviewCard` component

**Event Registration:**
- Registered events from VTOP via `POST /api/events/profile`
- Payment status tracking
- Event reminders in calendar view

### 14.2 EventPreviewCard (`Main.tsx:1905-1932`)

Lazy-loads event preview data:
- Poster image URL
- Description and meta details
- Loading skeleton state
- AbortController for fetch cancellation

### 14.3 Upcoming Events Banner

Dashboard shows an "Upcoming Events" section when:
- User has registered events
- Events are within the next 7 days
- Cards show: event name, date, time, venue, payment status

---

## 15. Push Notifications

### 15.1 PushPromptModal (`PushPromptModal.tsx`)

Prompt to enable push notifications:
- Requests notification permission
- Subscribes to push service via `/api/admin/push/subscribe`
- Stores subscription in database
- VAPID key-based web push

### 15.2 PushNotificationManager (`app/pushNotificationManager.tsx`)

Client-side push notification manager:
- Registration of service worker
- Subscription management
- Notification display handling

### 15.3 Admin Push Endpoints

- `POST /api/admin/push/subscribe` — Register subscription
- `POST /api/admin/push/send` — Send push to all subscribers
- `POST /api/admin/push/unsubscribe` — Remove subscription

---

## 16. Theme System

### 16.1 ThemeProvider (`components/themeprovider.tsx`)

Uses `next-themes` with three themes:
- **light** — Light background, dark text
- **dark** — Dark background, light text (Tailwind slate palette)
- **midnight** — Very dark (black) background with subtle styling

Default theme: `midnight`

### 16.2 Theme Classes

All components use the pattern:
```jsx
className="text-gray-900 dark:text-gray-100 midnight:text-white
           bg-white dark:bg-slate-800 midnight:bg-black"
```

### 16.3 Icon Theme

`IconUpdater.tsx` — Dynamically updates the app icon based on `localStorage.getItem("app-icon")`:
- `default` → `/logo.png`
- `fire` → `/icons/fire.png`

---

## 17. Service Worker & Offline

### 17.1 Serwist Configuration

Uses `@serwist/next` for PWA/service worker:
- Caches static assets
- Offline fallback page (`/~offline`)
- Push notification handling

### 17.2 Offline Detection

`Main.tsx:848-862` — Detects online/offline status:
- Shows yellow banner "You're currently offline" when offline
- Banners only show during logged-in state

### 17.3 Caching Strategy

Data is aggressively cached in `localStorage`:
- Attendance, marks, grades, schedule, hostel, calendar
- Moodle assignments, VITOL data
- Fresher EPT schedule, acknowledgements
- Bus routes
- Library due, KOHA patron pages
- Profile data
- Registered events

All data survives reloads and provides instant UI while fresh data is fetched.

---

## 18. Admin API Endpoints

All admin endpoints require `Authorization: Bearer <token>` header with HMAC-SHA256 signed token.

### 18.1 Auth
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/auth` | POST | Admin login with `ADMIN_SECRET`, returns token |
| `/api/admin/auth/verify` | GET | Verify admin token validity |

### 18.2 Database
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/migrate` | GET | List all database tables (health check) |
| `/api/admin/migrate` | POST | Run migration — creates all tables |

### 18.3 Fresher Resources
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/fresher-resources` | GET | List all resources (incl. inactive) |
| `/api/admin/fresher-resources` | POST | Create resource (link/text/md types) |
| `/api/admin/fresher-resources/[id]` | PATCH | Update resource fields |
| `/api/admin/fresher-resources/[id]` | DELETE | Delete resource |

**Resource fields:** `title`, `description`, `url`, `icon`, `sort_order`, `is_active`, `type` (`link`/`text`/`md`), `content`

### 18.4 Bus Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/buses` | GET | List all bus routes |
| `/api/admin/buses` | POST | Add bus route |
| `/api/admin/buses/[id]` | PATCH | Update bus route |
| `/api/admin/buses/[id]` | DELETE | Delete bus route |

### 18.5 Push Notifications
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/push/subscribe` | POST | Subscribe to push |
| `/api/admin/push/send` | POST | Send push notification |
| `/api/admin/push/unsubscribe` | POST | Unsubscribe from push |

### 18.6 OCR & Misc
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/ocr` | POST | OCR processing endpoint |
| `/api/admin/users` | GET | List admin users |
| `/api/admin/stats` | GET | Dashboard statistics |

### 18.7 Admin Token System (`lib/auth.ts`)

- **Signing:** HMAC-SHA256 with `ADMIN_SECRET` env variable
- **Payload:** `{ username, role, permissions[], exp (timestamp) }`
- **Format:** `base64(payload).signature`
- **Verification:** `crypto.timingSafeEqual` against timing attacks
- **Expiration:** 7 days
- **Permissions:** `dashboard`, `qbank`, `buses`, `push`, `users`
- Roles: `superadmin`, `admin`

---

## 19. Public API Endpoints (130+)

### 19.1 Core Academic

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/login` | POST | None | VTOP login with captcha solving |
| `/api/status` | GET | None | API health check |
| `/api/attendance` | POST | VTOP | Attendance data with OD tracking |
| `/api/marks` | POST | VTOP | Course marks & assessments |
| `/api/grades` | POST | VTOP | Current semester grades |
| `/api/all-grades` | POST | VTOP | All semesters grades with CGPA |
| `/api/schedule` | POST | VTOP | Exam schedule (CAT/FAT) |
| `/api/calendar` | POST | VTOP | Academic calendar |
| `/api/curriculum` | GET+POST | VTOP | Course curriculum/syllabus |
| `/api/course-page` | POST | VTOP | Individual course page data |

### 19.2 Hostel
| Endpoint | Description |
|----------|-------------|
| `/api/hostel` | Hostel details (block, room, mess) |
| `/api/hostel-attendance` | Hostel attendance |
| `/api/hostel-counselling` | Hostel counselling sessions |
| `/api/hostel-leave` | Leave applications & history |
| `/api/mess-menu` | Mess menu |
| `/api/mess-feedback` | Mess feedback submission |
| `/api/mess-selection` | Mess selection changes |

### 19.3 Day Scholar / Transport
| Endpoint | Description |
|----------|-------------|
| `/api/buses` | Bus routes & stops |
| `/api/transport` | Transport registration status |
| `/api/dayboarder` | Day scholar details |

### 19.4 Examinations
| Endpoint | Description |
|----------|-------------|
| `/api/arrear-details` | Arrear exam details |
| `/api/arrear-grade` | Arrear exam grades |
| `/api/arrear-schedule` | Arrear exam schedule |
| `/api/arrear-reg` | Arrear registration |
| `/api/makeup-exam` | Makeup exam details |
| `/api/makeup-schedule` | Makeup exam schedule |
| `/api/compre-exam` | Comprehensive exam details |
| `/api/compre-info` | Compre information |
| `/api/reexam` | Re-exam details |
| `/api/special-arrear` | Special arrear exam |

### 19.5 Course Management
| Endpoint | Description |
|----------|-------------|
| `/api/course-option-change` | Course option change requests |
| `/api/course-withdraw` | Course withdrawal |
| `/api/course-withdraw-view` | Course withdrawal view |
| `/api/course-completion` | Course completion status |
| `/api/coursework-reg` | Coursework registration |
| `/api/registration-schedule` | Registration schedule |
| `/api/registration-status` | Registration status |
| `/api/curriculum` | Course curriculum |

### 19.6 Projects & Thesis
| Endpoint | Description |
|----------|-------------|
| `/api/project` | Project details |
| `/api/project-course` | Project courses |
| `/api/project-file-upload` | Upload project files |
| `/api/thesis-status` | Thesis status |
| `/api/thesis-submission` | Thesis submission |
| `/api/capstone` | Capstone project |
| `/api/sap-project` | SAP project info |

### 19.7 Library
| Endpoint | Description |
|----------|-------------|
| `/api/koha/search` | KOHA catalog search |
| `/api/koha/login` | KOHA patron login |
| `/api/koha/patron` | KOHA patron details (checkouts, charges) |
| `/api/library-due` | Library due amounts |
| `/api/library-keys` | Library key requests |
| `/api/library-scanning` | Library scanning services |
| `/api/book-recommendation` | Book recommendations |

### 19.8 LMS / Moodle
| Endpoint | Description |
|----------|-------------|
| `/api/lms-data` | Moodle assignments & deadlines |
| `/api/lms-data/assignments` | Specific assignment details |

### 19.9 Student Profile
| Endpoint | Description |
|----------|-------------|
| `/api/student` | Student profile (name, regno, email, etc.) |
| `/api/profile-images` | Profile photos |
| `/api/credentials` | Student credentials |
| `/api/bank-info` | Bank account info |
| `/api/apaarid` | APAAR ID |
| `/api/biometric` | Biometric data |

### 19.10 Fees & Payments
| Endpoint | Description |
|----------|-------------|
| `/api/payments` | Fee dues & payment history |
| `/api/payment-receipts` | Fee receipt downloads |
| `/api/wallet` | Wallet balance & transactions |
| `/api/fees-intimation` | Fee intimation notices |
| `/api/online-transfer` | Online payment transfers |

### 19.11 Certificates & Documents
| Endpoint | Description |
|----------|-------------|
| `/api/bonafide` | Bonafide certificate |
| `/api/certificate` | Certificate download |
| `/api/transcript` | Transcript request |
| `/api/convocation` | Convocation details |
| `/api/eca-upload` | Extra-curricular activity upload |
| `/api/fine-upload` | Fine payment upload |
| `/api/mooc-upload` | MOOC certificate upload |
| `/api/project-file-upload` | Project file upload |

### 19.12 Fresher / New Student
| Endpoint | Description |
|----------|-------------|
| `/api/ept-schedule` | EPT/placement test schedule |
| `/api/acknowledgement` | Document acknowledgement |
| `/api/fresher-resources` | Fresher resource links (public, DB-backed) |

### 19.13 Social & Events
| Endpoint | Description |
|----------|-------------|
| `/api/events` | All public events |
| `/api/events/profile` | User's registered events |
| `/api/events/preview` | Event preview details |
| `/api/contact` | Contact information |
| `/api/class-messages` | Class group messages |

### 19.14 Research & Faculty
| Endpoint | Description |
|----------|-------------|
| `/api/faculty-info` | Faculty contact info |
| `/api/hod-dean` | HOD/Dean info |
| `/api/proctor` | Proctor details |
| `/api/proctor-messages` | Proctor messages |
| `/api/research-profile` | Research profile |
| `/api/research-docs` | Research documents |
| `/api/research-award` | Research awards |
| `/api/research-letters` | Research letters |
| `/api/research-templates` | Research templates |
| `/api/research-attendance` | Research attendance |
| `/api/ir-outbound` | International relations outbound |
| `/api/outgoing-report` | Outgoing report |

### 19.15 Registration & Applications
| Endpoint | Description |
|----------|-------------|
| `/api/exc-registration` | Extra-curricular registration |
| `/api/club-enrollment` | Club enrollment |
| `/api/facility-reg` | Facility registration |
| `/api/fdp-registration` | FDP registration |
| `/api/mooc-registration` | MOOC registration |
| `/api/mdp` | MDP program |
| `/api/pat-reg` | PAT registration |
| `/api/scholar-leave` | Scholar leave |
| `/api/scholar-verification` | Scholar verification |
| `/api/sem-request` | Semester request |
| `/api/student-withdraw` | Student withdrawal |
| `/api/swf-registration` | SWF registration |
| `/api/swf-attendance` | SWF attendance |
| `/api/swf-requisition` | SWF requisition |
| `/api/university-day` | University day registration |
| `/api/wishlist-registration` | Wishlist registration |
| `/api/update-loginid` | Login ID update |

### 19.16 Academic Services
| Endpoint | Description |
|----------|-------------|
| `/api/change-password` | Change VTOP password |
| `/api/circulars` | Academic circulars |
| `/api/feedback-status` | Course feedback status |
| `/api/slo-feedback` | SLO feedback |
| `/api/notifications` | Notifications |
| `/api/question-preview` | Question paper preview |
| `/api/outcome-set` | Outcome set |
| `/api/late-hour` | Late hour details |
| `/api/meeting-info` | Meeting information |
| `/api/online-exam-attempt` | Online exam attempt |
| `/api/paper-see-rev` | Paper revaluation |
| `/api/receipt-download` | Receipt download |
| `/api/vitol-data` | VITOL data |

### 19.17 QCM / QBank
| Endpoint | Description |
|----------|-------------|
| `/api/qcm` | QCM data |
| `/api/qcm-view` | QCM view |
| `/api/qbank` | Question bank |
| `/api/question-preview` | Question preview |

### 19.18 Additional
| Endpoint | Description |
|----------|-------------|
| `/api/additional-learning` | Additional learning courses |
| `/api/achievements` | Student achievements |
| `/api/minor-honour` | Minor/Honour courses |
| `/api/extra-curricular` | Extra-curricular activities |
| `/api/internship` | Internship details |
| `/api/late-hour` | Late hour management |
| `/api/sap-info` | SAP info |
| `/api/stats` | API usage stats |
| `/api/test-login` | Test login endpoint |

### 19.19 Cron / Scheduled
| Endpoint | Description |
|----------|-------------|
| `/api/cron/reminders` | Scheduled reminder jobs |

---

## 20. Settings & Configuration

### 20.1 Config (`config.json`)

```json
{
  "semesterIDs": [
    "VITCBH2024WEFA2024CAP2024CAP",
    ...
  ]
}
```

Semester IDs are used to target specific academic semesters when fetching data.

### 20.2 Settings State (`Main.tsx:42-61`)

```typescript
type settings = {
  decimalValues: boolean;           // Show attendance as decimals
  CGPAHidden: boolean;              // Hide CGPA from stats cards
  attendancePercentageOrString:     // "percentage" | "str" (X/Y format)
  currSemesterID: string;          // Currently selected semester
  calendarType: string;            // ALL, ALL02, ALL03, ALL05, ALL06, ALL08, ALL11, WEI
  loadingScreen: boolean;          // Show animated reload modal
  isDayscholarWithBus: boolean;    // Dayscholar with bus transport
  residentialStatus: string;       // "hosteller" | "dayscholar"
  friendlyName?: string;           // Display name
  isSidebarCollapsed?: boolean;    // Desktop sidebar state
  hideMobileHeader?: boolean;      // Hide mobile top header
  reloadAllData?: boolean;         // Reload everything on refresh
}
```

### 20.3 Environment Variables

**AmazeCC (frontend):**
- `NEXT_PUBLIC_API_URL` — API base URL (default: `https://api.amazecc.com`)

**AmazeCC-API (backend):**
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_SECRET` — HMAC signing secret for admin tokens
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — Web push notification keys
- `DEEPSEEK_API_KEY` — For AI features

**AmazeCC-Dashboard:**
- `NEXT_PUBLIC_API_URL` — API base URL (default: `http://localhost:3000`)

---

## 21. Build, Test & Deployment

### 21.1 Scripts

**AmazeCC:**
```bash
npm run dev          # Next.js dev server on :3001 (HTTPS)
npm run build        # Production build (webpack)
npm run start        # Start production server on :3001
npm run test         # Vitest run
npm run lint         # ESLint
```

**AmazeCC-API:**
```bash
npm run dev          # Next.js dev server on :3000
npm run build        # Production build
npm start            # Start production server on :3000
```

### 21.2 Database Migrations

Run `/api/admin/migrate` (POST) to create all tables:

**Tables created:**
- `buses` — Bus route data
- `papers_archive` — Question papers archive
- `qbank_questions` — Question bank questions
- `qbank_topics` — Question bank topics
- `qbank_question_topics` — Question-topic relationships
- `fresher_resources` — Fresher resource links (with type/content support)
- `admin_users` — Admin accounts with roles/permissions

### 21.3 Activity Tree

`lib/activit-tree.ts` — Tracks login streak/activity:
- Increments on each successful login
- Stored in `localStorage`
- `loadActivityTree()` / `saveActivityTree()` functions

### 21.4 Marks Sync

`lib/marksSync.ts` — `syncMarksDiff()`:
- Compares old vs new marks data
- Detects changes in assessments
- Can trigger notifications on grade changes

### 21.5 Export Features

- **iCal export** (`lib/exportIcal.ts`) — Export timetable to iCalendar format
- **Timetable export** (`lib/exportTimetable.ts`) — Export timetable as PDF/image
- **PDF generation** — Using jspdf + html2canvas

### 21.6 Analytics

- Google Analytics via `@next/third-parties/google`
- Two GA IDs: `G-40NYS6B13N` and `G-2H76BLP4VK`

---

## Appendix A: Data Flow Diagram

```
User opens app
  ↓
Main.tsx mounts
  ├── Restore all localStorage data (instant render)
  ├── Check API /status endpoint
  └── Detect offline status
  ↓
Login Form (if not logged in)
  ├── VTOP login via /api/login
  ├── Attendance fetch via /api/attendance
  ├── Marks fetch via /api/marks
  ├── Student profile via /api/student
  ├── Parallel: grades + schedule + hostel + calendar + allGrades + events + profileImages
  ├── Fresher data: ept-schedule + acknowledgement
  ├── Bus routes: /api/buses
  ├── Bulk cache: 20+ endpoints for GenericApiView
  └── Moodle/LMS data via /api/lms-data
  ↓
Dashboard renders
  ├── Stats cards
  ├── Tab navigation
  ├── Content per active tab
  └── Command palette
```

## Appendix B: Database Schema (fresher_resources)

```sql
CREATE TABLE IF NOT EXISTS fresher_resources (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  url TEXT,                              -- nullable for text/md types
  icon TEXT DEFAULT 'ExternalLink',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  type TEXT DEFAULT 'link'               -- 'link' | 'text' | 'md'
    CHECK (type IN ('link', 'text', 'md')),
  content TEXT DEFAULT '',               -- plain text or markdown body
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Appendix C: Shadow DOM / Styling Architecture

```
Tailwind CSS v4 (@tailwindcss/postcss)
  └── @import "tailwindcss" in globals.css
  └── tw-animate-css (animation utilities)
  └── @radix-ui/* (headless primitives)
  └── shadcn/ui style components (button, card, dialog, etc.)
  
ThemeProvider (next-themes)
  ├── attribute="class"
  ├── defaultTheme="midnight"
  ├── light → class="light"
  ├── dark  → class="dark"
  └── midnight → class="midnight"
  
Component styling pattern:
  className="base dark:dark-variant midnight:midnight-variant"
```

## Appendix D: Key Dependencies Map

```
Component Layer:
├── @radix-ui/react-dialog        → Modal, CommandPalette background
├── @radix-ui/react-tabs          → Sub-tab navigation
├── @radix-ui/react-dropdown-menu → Dropdown menus
├── @radix-ui/react-popover       → Popovers
├── cmdk                          → Command palette engine
├── framer-motion                 → Animated transitions, modals
├── lucide-react                  → Icon library
│
Data Layer:
├── pg (node-postgres)            → Database queries
├── axios                         → HTTP client for VTOP
├── tough-cookie                  → Cookie jar for VTOP sessions
├── cheerio                       → HTML parsing for VTOP scraping
│
UI Enhancements:
├── react-markdown                → Markdown resource rendering
├── recharts                      → Charts (GPA predictor, etc.)
├── react-circular-progressbar    → Circular progress indicators
├── swiper                        → Carousel/slider
├── katex / react-latex-next      → LaTeX rendering for QBank
├── html-to-image / jspdf         → Export to image/PDF
├── qrcode.react                  → QR code generation
│
PWA:
├── @serwist/next                 → Service worker
├── web-push                      → Push notifications
```

---

*Generated from codebase analysis.  
Frontend: 190+ components across 40+ directories  
API: 130+ endpoints across 40+ feature categories  
Commit: This document covers ALL features implemented as of v2.1.0*
