# AmazeCC

<p align="center">
  <img src="public/images/icons/AmazeCC.png" width="320" alt="AmazeCC">
</p>

<p align="center">
  <strong>A unified student operating system for VIT University</strong>
</p>

<p align="center">
<<<<<<< HEAD
  <a href="https://amazecc.com">Live Site</a> ·
  <a href="https://api.amazecc.com">API Docs</a> ·
=======
  <a href="https://amazecc.com"><strong>Live Site</strong></a> ·
  <a href="https://api.amazecc.com/docs"><strong>API Docs</strong></a> ·
  <a href="https://api.amazecc.com/stats"><strong>API Stats</strong></a>
>>>>>>> main
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/AmazeContinuityProjects/AmazeCC?style=flat-square&label=License" alt="License">
  <img src="https://img.shields.io/github/last-commit/AmazeContinuityProjects/AmazeCC/main?style=flat-square&label=Last%20Commit" alt="Last Commit">
  <img src="https://img.shields.io/github/repo-size/AmazeContinuityProjects/AmazeCC?style=flat-square&label=Repo%20Size&color=blueviolet" alt="Repo Size">
  <br>
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript_5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=flat-square&logo=framer&logoColor=white" alt="Framer">
  <img src="https://img.shields.io/badge/Radix_UI-FF4D4D?style=flat-square&logo=radixui&logoColor=white" alt="Radix UI">
</p>

---

## Overview

AmazeCC is a comprehensive student dashboard for **VIT University**, replacing the clunky official VTOP portal with a fast, modern, and intuitive experience. It aggregates attendance, grades, schedules, hostel info, library services, payments, events, and more — all in one place.

> Originally forked from [Arya4930/UniCC](https://github.com/Arya4930/UniCC) · Captcha solver adapted from [arshsaxena/ViBoot-Enhanced](https://github.com/arshsaxena/ViBoot-Enhanced)

---

## Features

| Area | Features |
|------|----------|
| **Academics** | Attendance tracking with color-coded percentages, marks & assessment breakdown, semester-wise grades with CGPA tracking, GPA predictor & what-if simulations, exam schedule (CAT/FAT) with venue info, course curriculum & syllabus viewer |
| **Campus Life** | Hostel mess menu, laundry & leave management, day scholar transport & bus route finder, library catalog search (KOHA integration), fee dues, payment history & receipts, event discovery & registration (EventHub), cab sharing platform |
| **Productivity** | Command palette (Ctrl+K) with fuzzy search, real-time attendance predictor, Moodle/LMS assignment deadlines, academic calendar with event overlay, on-duty (OD) hours tracker, course dashboard with deep analytics |
| **Experience** | Light / Dark / Midnight themes, custom accent colors & palettes, PWA with offline support, push notifications, touch gesture navigation, export to PDF, iCal & images |

---

## Architecture

```
                          AmazeCC (Next.js 16)
                              :3001
                                │
                    Main.tsx (Entry) → LoginForm / Dashboard
                        │
                    NavigationTabs (desktop sidebar + mobile nav)
                        │
                    StatsCards (attendance, CGPA, marks, OD)
                        │
                    Sub-tab content (conditional render)
                        │
                    CommandPalette (Ctrl+K overlay)
                        │
              ┌─────────┴──────────┐
              │                    │
         API_BASE ← env(NEXT_PUBLIC_API_URL)
              │                    │
              ▼                    ▼
        AmazeCC API         External Services
     (Next.js API Routes)   (Supabase, VTOP, etc.)
      ~130 POST endpoints
       ~15 GET endpoints
        ~10 Admin endpoints
```

<p align="center">
  <strong>Frontend:</strong> Next.js 16, TypeScript, Tailwind CSS v4, Framer Motion, Radix UI, Recharts ·
  <strong>Backend:</strong> Next.js API Routes, PostgreSQL, Cheerio, Axios, tough-cookie
</p>

---

## Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion">
  <img src="https://img.shields.io/badge/Radix_UI-FF4D4D?style=for-the-badge&logo=radixui&logoColor=white" alt="Radix UI">
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA">
</p>

---

## API Endpoints

| Category | Endpoints |
|----------|-----------|
| **Auth** | `/api/login`, `/api/status` |
| **Academic** | `/api/attendance`, `/api/marks`, `/api/grades`, `/api/all-grades`, `/api/schedule`, `/api/calendar` |
| **Hostel** | `/api/hostel`, `/api/hostel-leave`, `/api/mess-menu`, `/api/mess-feedback` |
| **Profile** | `/api/student`, `/api/profile-image`, `/api/bank-info` |
| **Payments** | `/api/payments`, `/api/payment-receipts`, `/api/wallet`, `/api/online-transfer` |
| **Library** | `/api/koha/search`, `/api/koha/login`, `/api/koha/patron`, `/api/library-due` |
| **Transport** | `/api/buses`, `/api/transport`, `/api/dayboarder` |
| **Events** | `/api/events`, `/api/events/profile`, `/api/clubs/details` |
| **LMS** | `/api/lms-data`, `/api/lms-data/assignments` |
| **Exams** | `/api/arrear-details`, `/api/makeup-exam`, `/api/compre-exam`, `/api/reexam` |
| **Research** | `/api/faculty-info`, `/api/research-profile`, `/api/project` |
| **Admin** | `/api/admin/auth`, `/api/admin/fresher-resources`, `/api/admin/buses`, `/api/admin/migrate` |

> Full API documentation is available at [api.amazecc.com](https://api.amazecc.com).

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Frontend

```bash
git clone https://github.com/AmazeContinuityProjects/AmazeCC.git
cd AmazeCC
npm install
npm run dev          # → http://localhost:3001
```

### Backend (Self-Hosted)

The app uses the hosted API (`https://api.amazecc.com`) by default. To run your own:

```bash
# Set up environment
MONGODB_URI=          ADMINS=
B2_ENDPOINT=          ID_SALT=
B2_BUCKET_NAME=       SMTP_PASS=
B2_ACCESS_KEY_ID=     SMTP_USER=
B2_SECRET_ACCESS_KEY= SMTP_HOST=
B2_REGION=

npm run api-build
npm run api-start
```

Override the API URL via `NEXT_PUBLIC_API_URL` env var or in `src/components/custom/Main.tsx`:
```ts
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com";
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server (:3001, HTTPS) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run Vitest tests |
| `npm run lint` | Run ESLint |
| `npm run api-dev` | Start backend in dev mode |
| `npm run api-build` | Build backend |
| `npm run api-start` | Start backend production |

---

## Project Stats

<p align="center">
  <img src="https://img.shields.io/github/commit-activity/m/AmazeContinuityProjects/AmazeCC?style=for-the-badge&label=Commits%2FMonth" alt="Commit Activity">
  <img src="https://img.shields.io/github/contributors/AmazeContinuityProjects/AmazeCC?style=for-the-badge&label=Contributors" alt="Contributors">
  <img src="https://img.shields.io/github/repo-size/AmazeContinuityProjects/AmazeCC?style=for-the-badge&label=Repo%20Size" alt="Repo Size">
  <img src="https://api.visitorbadge.io/api/visitors?path=https%3A%2F%2Fgithub.com%2FAmazeContinuityProjects%2FAmazeCC&countColor=%23263759" alt="Visitors">
</p>

---

## Contributing

Contributions are welcome! Feel free to fork the repo and submit pull requests.

1. Fork the project
2. Create a feature branch (`git checkout -b feat/amazing`)
3. Commit your changes (`git commit -m 'feat: add amazing thing'`)
4. Push to the branch (`git push origin feat/amazing`)
5. Open a Pull Request

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

---

## Contributors

<p align="center">
  <a href="https://github.com/AmazeContinuityProjects"><img src="https://img.shields.io/badge/AmazeContinuityProjects-181717?style=for-the-badge&logo=github&logoColor=white" alt="Org"></a>
  <a href="https://github.com/SugeethJSA"><img src="https://img.shields.io/badge/SugeethJSA-181717?style=for-the-badge&logo=github&logoColor=white" alt="SugeethJSA"></a>
  <a href="https://github.com/dhivyanj"><img src="https://img.shields.io/badge/dhivyanj-181717?style=for-the-badge&logo=github&logoColor=white" alt="dhivyanj"></a>
  <a href="https://github.com/ANASARFEEN123"><img src="https://img.shields.io/badge/ANASARFEEN123-181717?style=for-the-badge&logo=github&logoColor=white" alt="ANASARFEEN123"></a>
</p>
