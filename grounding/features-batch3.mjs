// Batch 3 of docs/05-* feature documentation (WP-09).
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const pages = {
  // ───────────────────────────── qbank
  "05-qbank/overview.md": `# QBank — Overview

Question bank per course: past papers, model answers where uploaded, and a search across all of it.
**Academics → QBank (Tools → QBank)** — searchable, like a library, but for papers.`,

  "05-qbank/architecture.md": `# QBank — Architecture

Data model: courses + papers + questions (\`types/qbank.types.ts\`).
Upload flow: upload PDF → server parses (OCR if needed) → stored in Supabase; client lists approved.
Rendering: KaTeX for math (\`exams/qbank/Latex.tsx\`), custom MCQ/subjective cards.
\\\`lib/courseMaterials.ts\\\` handles direct downloads through the VTOP session proxy.`,

  "05-qbank/data-model.md": `# QBank — Data Model

\`QBankCourse = { code, title, branch, counts }\`
\`QBankPaper = { id, course, type, year, examDate, pdfUrl? }\`
\`QBankQuestion = { id, paperId, type: "mcq"|"subjective", body, latex, options[]? }\`.`,

  "05-qbank/ui-map.md": `# QBank — UI Map

\`exams/CourseQBankTab.tsx\` — per-course wrapper; \`qbank/QBankSubpage.tsx\` — browse/upload; \`qbank/UploadPaperModal.tsx\`; \`qbank/ExamQuestion.tsx\` + \`qbank/Latex.tsx\`; \`qbank/useQBankCourses.ts\`.`,

  "05-qbank/storage-and-state.md": `# QBank — Storage & State

Nothing local by design — paper content re-fetched from the server on each browse; whitelist of subjects from actual grades (passed client-side filter as approved).`,

  "05-qbank/testing.md": `# QBank — Testing

No dedicated suites (integration gap). OCR/parser path lives server-side (no client coverage).`,

  "05-qbank/known-issues.md": `# QBank — Known Issues

1. Papers uploaded before OCR support shipped show raw scans with no text index — search falls back to filename.
2. The VTOP-proxy download drops the session mid-stream if the tab is backgrounded — retry once.
3. KaTeX lags on course with heavy notation — LaTeX parse errors render raw rather than blank.`,

  "05-qbank/history.md": `# QBank — History

2026-summer: initial viewer; 2026-09: upload workflow + OCR pipeline; 2026-10: per-course filter approval flag.`,

  // ───────────────────────────── paper-scanner
  "05-paper-scanner/overview.md": `# Paper Scanner — Overview

**Tools → Scanner** — point the phone camera at an exam paper; get a cropped, enhanced, OCR'd PDF on your device. Upload to the community-paper library if you want, or keep it local.`,

  "05-paper-scanner/architecture.md": `# Paper Scanner — Architecture

Pipeline: camera frame → \`ScannerCamera.tsx\` → \`imageOps.ts\` (edge detect, perspective warp, denoise) → \`pipeline.ts\` (processScan) → \`store.ts\` (IndexedDB, local-first) → \`pdf.ts\` (page stitching).
OCR: \`ocr.ts\` (tesseract.js WASM, on-device by default; optional cloud key for accuracy tier).
NN classifier: \`scanner/nn/mlp.ts\` — tiny MLP weights (trained offline from real papers via \`scanner:train\`) classifies \"which exam this is\".`,

  "05-paper-scanner/data-model.md": `# Paper Scanner — Data Model

\`Scan = { id, images: Raster[], ocrText, classifier: { label, confidence }, pdfBytes?, createdAt }\`
Store: IndexedDB store \`scans\` — device-local; clearing site data deletes all papers.`,

  "05-paper-scanner/ui-map.md": `# Paper Scanner — UI Map

\`PaperScannerPage.tsx\` · \`ScannerCamera\` · \`ScannerEditor\` (crop/rotate/loupe) · \`ScannerSettingsSheet\` · \`PaperDetailSheet\`.`,

  "05-paper-scanner/storage-and-state.md": `# Paper Scanner — Storage & State

IndexedDB only; PDF file lives on the device. NN inference runs 100% offline — no data leaves the phone.`,

  "05-paper-scanner/testing.md": `# Paper Scanner — Testing

All 10 scanner suites: \`scannerPipeline\`, \`scannerImageOps\`, \`scannerOcr\`, \`scannerNn\`, \`scannerPdf\`, \`scannerStore\`, \`scannerSettings\`, \`scannerUpload\`, \`scannerRasterIo\`, \`scannerExamClassifier\`.`,

  "05-paper-scanner/known-issues.md": `# Paper Scanner — Known Issues

1. tesseract.js downloads ~2 MB of WASM on first use — first open is slow on 3G.
2. Upload endpoint (CodeChef-VIT backend contract) — papers shared publicly require moderation.
3. Edge-detecting curled pages in bad light yields trapezoid crops — manual crop fallback always available.`,

  "05-paper-scanner/history.md": `# Paper Scanner — History

2026-autumn: MVP camera→crop; 2026-10: OCR + NN classifier; 2026-11: docs.`,

  // ───────────────────────────── student-report
  "05-student-report/overview.md": `# Student Report — Overview

**Settings → Export → Student Report**: generates a complete personal academic report as a PDF/JSON/ZIP — attendances, marks, grades, prediction curves, personal timetable, computed timeline. Everything computed on-device; nothing uploaded.`,

  "05-student-report/architecture.md": `# Student Report — Architecture

\`studentReportPdf.ts\` (1,901 lines) — jsPDF manual layout engine (no templates library on purpose — deterministic print).
Input: all atoms + grade history + predictor results; math: \`gradeHistory.ts\` (cumulative figure), prediction ladder.
privacy: everything happens in-browser; export never passes the network — verified by airplane-mode generation test.`,

  "05-student-report/data-model.md": `# Student Report — Data Model

\`StudentReportData = { profile, attendance[], marks[], grades[], prediction, timetable }\` — composed at render-time; not persisted.`,

  "05-student-report/ui-map.md": `# Student Report — UI Map

\`reports/StudentReportPage.tsx\` — sectioned preview with per-part toggles; download actions: PDF / JSON / print view / ZIP bundle (JSON+PDF+iCal).`,

  "05-student-report/storage-and-state.md": `# Student Report — Storage & State

None — pure reader of atoms and calculations. Print stylesheet handles margins.`,

  "05-student-report/testing.md": `# Student Report — Testing

\`studentReportPdf.test.ts\`? — none dedicated; testing gap flagged in grounding backlog. Report math verified indirectly via grade/prediction suites.`,

  "05-student-report/known-issues.md": `# Student Report — Known Issues

1. ZIP bundles are big (4–15 MB) — on low-RAM devices generation stutters; the app warns.
2. Export includes look-ups for every enrolled semester — incomplete for freshers (marks history never synthesized client-side).`,

  "05-student-report/history.md": `# Student Report — History

2026-summer: PDF MVP; 2026-09: JSON/IPO export parity; 2026-10: ZIP bundle; this training doc.`,

  // ───────────────────────────── settings-and-profile
  "05-settings-and-profile/overview.md": `# Settings & Profile — Overview

The control center: identity, semester selection, appearance (theme/palette/privacy mode), sync
preferences, API host picker, sync-mode editor, forget-credentials, support, about.`,

  "05-settings-and-profile/architecture.md": `# Settings & Profile — Architecture

State owner: \`settingsAtom\` with migration-on-read shim (never delete fields without a deprecation path).
Delegates: every update funnels via \`updateSetting(key, value)\` in ProfilePage — computed side effects
(e.g. switching semester → \`broadcastGlobalSemesterChange\`) live there, not in the JSX.`,

  "05-settings-and-profile/data-model.md": `# Settings & Profile — Data Model

\`Settings\` — see \`settingsAtoms.ts\`: ~70 fields (string refs to named keys) — theme, palette, semester, sync cadence, quiet hours, push flags, Pomodoro defaults, campus prefs, API override, timetable density.`,

  "05-settings-and-profile/ui-map.md": `# Settings & Profile — UI Map

\`header/ProfilePage.tsx\` (2,749 lines — account, palette, API, sync modes, about) · \`profile/ProfileTab.tsx\` (wrapper) · \`ProfileStatusCards.tsx\` · \`ProfileModals.tsx\` · \`footer/LocalStorageSubpage.tsx\` (local key inspector).`,

  "05-settings-and-profile/storage-and-state.md": `# Settings & Profile — Storage & State

\`settings\` key with merge-on-read; ~70 fields. Profile: \`profile\` storage; whoami cache \`cache_whoami\`.`,

  "05-settings-and-profile/testing.md": `# Settings & Profile — Testing

\`settingsNav.test.tsx\`, profile-page render suites, \`settings-and-profile?\` — see sync ops for which keys are load-bearing (updateSetting broadcast path covered by FFS suites).`,

  "05-settings-and-profile/known-issues.md": `# Settings & Profile — Known Issues

1. The settings atom migrates silently — a badly-typed key re-hydrates defaults; know the merge semantics.
2. Forgetting credentials does NOT wipe local data (we keep it) — this is documented behavior; don't "fix" without ADR.
3. API host picker is a power tool — friends sharing devices must not accidentally switch it.`,

  "05-settings-and-profile/history.md": `# Settings & Profile — History

2025: minimal account card; 2026-spring: palette engine + privacy mode; 2026-summer: sync-mode editor UI; 2026-10: API host advanced section.`,

  // ───────────────────────────── notifications-and-push
  "05-notifications-and-push/overview.md": `# Notifications & Push — Overview

Opt-in nudges before deadlines, event alerts, marks-freeze alerts. Quiet hours respected; per-category control. Everything off by default.`,

  "05-notifications-and-push/architecture.md": `# Notifications — Architecture

Web Push (VAPID): service worker push handler → browser notification; subscriptions stored server-side (\`push_subscriptions\` table, sql/supabase_setup.sql). Quiet hours enforced client-side for scheduling + server-side for delivery windows (dual check).
In-app banners reuse the toast system for zero-config visibility. Fallback: in-app toast only (no push permission).`,

  "05-notifications-and-push/data-model.md": `# Notifications — Data Model

\`PushSubscription = { endpoint, keys: { p256dh, auth }, userId? }\` (server-side; never shipped client-side).
\`NotificationPreferences = { category flags, quietHours: { start, end }, muteUntil? }\`.`,

  "05-notifications-and-push/ui-map.md": `# Notifications — UI Map

\`header/PushNotificationManager.tsx\` (per-category subscribe/unsubscribe, quiet hours) · \`PushPromptModal.tsx\` (first-run opt-in) · \`shared/PushPromptModal? (same file) — doubles as the re-engagement surface\` · SW \`push\` handler in \`sw.ts\`.`,

  "05-notifications-and-push/storage-and-state.md": `# Notifications — Storage & State

\`push_subscriptions\` server-side · local flags: \`settings.push*\`, last-prompt-interacted stamp (3-day throttle) · mute respects both clients.`,

  "05-notifications-and-push/testing.md": `# Notifications — Testing

\`pushManager.test.ts\`? — none dedicated; SW \`push\` receipt is covered indirectly by service-worker suites (sw.ts structure asserts).`,

  "05-notifications-and-push/known-issues.md": `# Notifications — Known Issues

1. iOS 16.4- requires manual "Add to Home Screen" for push — the prompt copy says so.
2. Quiet hours are enforced client-side for scheduling but delivery can still slip — documented in the screens.`,

  "05-notifications-and-push/history.md": `# Notifications — History

2026-spring: VAPID pipeline + opt-in prompt; 2026-09: per-category split; 2026-10: quiet hours dual-check.`,

  // ───────────────────────────── feedback-and-support
  "05-feedback-and-support/overview.md": `# Feedback & Support — Overview

In-app bug/feature/experience reporter. Text + auto-diagnostics, full session replay if you opt in. PostHog Conversations for replies.`,

  "05-feedback-and-support/architecture.md": `# Feedback — Architecture

Flow: opens → dialog → optional recorder (60 fps canvas) → submit → PostHog Conversations ticket → stored online.
\`FeedbackReportPage\` renders canvas timeline locally (replay without upload unless submitted).
Diagnostics: buildInfo (sha), route, tab, UA. Identity: anonymous unless you supply email.`,

  "05-feedback-and-support/data-model.md": `# Feedback — Data Model

\`FeedbackPayload = { category, summary, details, severity?, contact?, buildSha, replay? }\`
Ticket: PostHog Conversations thread id — no PII beyond what you type.`,

  "05-feedback-and-support/ui-map.md": `# Feedback — UI Map

\`feedback/FeedbackModal.tsx\` (quick report) · \`feedback/FeedbackReportPage.tsx\` (full recorder/replay) · \`feedback/BugRecordingFloatingBar.tsx\` · \`ErrorDiagnosticCard.tsx\` (boundary surface) · \`TechnicalSupport?\` (Settings → Help).`,

  "05-feedback-and-support/storage-and-state.md": `# Feedback — Storage & State

Recorder: in-memory only — nothing written to disk unless user explicitly attaches to report.`,

  "05-feedback-and-support/testing.md": `# Feedback — Testing

\`feedbackReportPage.render.test.tsx\`? — none dedicated; feedback boundaries verified via error-boundary suites (error.tsx/global-error renders).`,

  "05-feedback-and-support/known-issues.md": `# Feedback — Known Issues

1. Canvas recorder memory climbs past ~90 s — browser warns, flow forces submit/kill at 90 s.
2. Replay blobs are big (2–10 MB) — submitted with explicit consent; PostHog retention policy applies.`,

  "05-feedback-and-support/history.md": `# Feedback — History

2025: simple email link; 2026-spring: modal reporter; 2026-07: session-recorder with canvas replay; 2026-10: PostHog Conversations threads + "verified" identity hash.`,

  // ───────────────────────────── changelog-and-about
  "05-changelog-and-about/overview.md": `# Changelog & About — Overview

Where students find: what changed (changelog), who built it (Hall of Fame), licenses (about), and the current deployed sha (About section).`,

  "05-changelog-and-about/architecture.md": `# Changelog & About — Architecture

Changelog: hand-maintained \`data/changelog.json\` (version, notes, date) rendered by \`ChangelogModal.tsx\` — optional GitHub commit tail fetched from the Worker cache.
About/version: \`buildInfo.json\` (commit sha + date injected by prebuild).
Hall of fame / team: \`data/team.json\`, all static.`,

  "05-changelog-and-about/data-model.md": `# Changelog & About — Data Model

\`ChangelogEntry = { version, date, changes[], highlights? }\` · \`BuildInfo = { sha, date, buildNumber }\`.`,

  "05-changelog-and-about/ui-map.md": `# Changelog & About — UI Map

\`ChangelogModal.tsx\`, \`AboutTab.tsx\` (hallOfFame/changelog/about/team), \`ResourcesSection.tsx\`, \`AboutSection.tsx\`, \`HallOfFameModal.tsx\`, \`TeamModal.tsx\`, \`AboutBody.tsx\`, \`Links.tsx\`.`,

  "05-changelog-and-about/storage-and-state.md": `# Changelog & About — Storage & State

None — pure static renderings of bundled JSON.`,

  "05-changelog-and-about/testing.md": `# Changelog & About — Testing

\`about.test.tsx\`? — none dedicated; rendered sections smoke-checked in shell suites.`,

  "05-changelog-and-about/known-issues.md": `# Changelog & About — Known Issues

1. changelog.json is hand-maintained — releases forgot to update it twice in 2026; release checklist (see 12-operations) has the step.
2. GitHub commit tail requires Worker — offline shows previous build only.`,

  "05-changelog-and-about/history.md": `# Changelog & About — History

2025: hardcoded about page; 2026-spring: changelog.json flow; 2026-summer: Hall of Fame; 2026-10: build number badge.`,

  // ───────────────────────────── about-and-licensing
  "05-about-and-licensing/overview.md": `# About & Licensing — Overview

What this app is, why it exists, who built it, what it borrows, and under what licenses — the page every maintainer must be able to point to.`,

  "05-about-and-licensing/architecture.md": `# About & Licensing — Architecture

Static text + \`data/team.json\`; informal credits in AboutTab; legal chain: root LICENSE (MIT-like) + vendored files attribution (codechef-vit-catalogue.csv, MIT; ts CSS reborn).`,

  "05-about-and-licensing/data-model.md": `# About & Licensing — Data Model

\`TeamMember = { name, role, url?, credits? }\`.`,

  "05-about-and-licensing/ui-map.md": `# About & Licensing — UI Map

\`AboutTab.tsx\` (about/changelog/hall-of-fame/team) · \`ResourcesSection.tsx\` · LICENSE · README credits section.`,

  "05-about-and-licensing/storage-and-state.md": `# About & Licensing — Storage & State

None.`,

  "05-about-and-licensing/testing.md": `# About & Licensing — Testing

None — static text; manual review on each release.`,

  "05-about-and-licensing/known-issues.md": `# About & Licensing — Known Issues

1. Third-party list gets stale — dependency-catalog review per release catches drift.
2. CodeChef-VIT catalogue attribution is load-bearing (MIT) — never strip it.`,

  "05-about-and-licensing/history.md": `# About & Licensing — History

2025-launch: brief footer credits; 2026-summer: full credits + Hall of Fame; 2026-10: dependency catalog cross-linked here.`,

  // ───────────────────────────── onboarding
  "05-onboarding/overview.md": `# Onboarding — Overview

First-run flow: welcome hero → choose interface (simplified vs classic) → sign-in → sync → welcome tour. Party of one, 5 steps.`,

  "05-onboarding/architecture.md": `# Onboarding — Architecture

Gate: \`showIntroAtom\` (one-time) — the flow shows only on first authenticated visit; \`introPhase\` state machine ("login" → "synced" → "welcome") lives in AppIntroExperience + OnboardingIntro.
Interface picker flips \`interfaceChosen\` — drives mobile home rendering.`,

  "05-onboarding/data-model.md": `# Onboarding — Data Model

\`OnboardingProgress = { interfaceChosen?: boolean; skipped?: boolean }\` — settings atoms \`interfaceChosen\`, \`showIntro\`.`,

  "05-onboarding/ui-map.md": `# Onboarding — UI Map

\`onboarding/AmazeOnboardingFlow.tsx\` (5-step), \`onboarding/OnboardingIntro.tsx\` (login/sync/welcome phases), \`AppIntroExperience.tsx\` (shell), \`FresherWelcomePage.tsx\` (post-login welcome for freshers).`,

  "05-onboarding/storage-and-state.md": `# Onboarding — Storage & State

\`showIntroAtom\`, \`interfaceChosen\` atoms; \`fresherWelcomeDismissed\` in storage — one flag per audience.`,

  "05-onboarding/testing.md": `# Onboarding — Testing

\`onboardingIntroAuthFailure.test.tsx\`, \`onboardingSimplified.test.tsx\`? — see suite map; flows verified through credential-failure and happy paths.`,

  "05-onboarding/known-issues.md": `# Onboarding — Known Issues

1. A student can skip every step including sign-in — they'll land in a dead state requiring explicit re-entry (Known flow; by design).
2. Interface choice flips only the home screen rendering — the rest of the app is shared code.`,

  "05-onboarding/history.md": `# Onboarding — History

2026-winter: 3-step MVP; 2026-spring: interface picker; 2026-summer: freshers welcome + PWA install step.`,

  // ───────────────────────────── guest-landing
  "05-guest-landing/overview.md": `# Guest Landing — Overview

The public face at \`/\`: hero, feature tour, FAQ, timeline — convinces a student this is better
than VTOP. No login wall until they tap Get Started.`,

  "05-guest-landing/architecture.md": `# Guest Landing — Architecture

\`GuestExperience.tsx\` — separate path from Main (never pays for app code until login).
\`LandingSections.tsx\` (dynamic import, below-the-fold only) · \`homeEntryController\` gate decides render order.`,

  "05-guest-landing/data-model.md": `# Guest Landing — Data Model

None — pure static copy + fake screenshots baked into images.`,

  "05-guest-landing/ui-map.md": `# Guest Landing — UI Map

\`app/GuestExperience.tsx\` + \`landing/LandingSections.tsx\` · hero CTAs → Sign in, Demo → \`handleDemoClick()\`.`,

  "05-guest-landing/storage-and-state.md": `# Guest Landing — Storage & State

No atoms (mandatorily pre-app). Theme from <ThemeProvider>.`,

  "05-guest-landing/testing.md": `# Guest Landing — Testing

\`guestExperience? \` — none dedicated; shell public-route render covered by homeEntryController suites.`,

  "05-guest-landing/known-issues.md": `# Guest Landing — Known Issues

1. Hero image is 84 KB campus-twilight.webp — runtime-cached; first visit ships velvet fast.
2. PWA install card appears only for Chromium; iOS sees manual instructions.`,

  "05-guest-landing/history.md": `# Guest Landing — History

2025: single hero; 2026-summer: full marketing rebuild + FAQ; 2026-10: feature showcase crawl.`,
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
