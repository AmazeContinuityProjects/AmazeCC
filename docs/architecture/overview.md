# Architecture Overview

AmazeCC follows a modern, full-stack architecture built on Next.js 16 with a clear separation between frontend and backend concerns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AmazeCC System                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Frontend (Next.js 16)                  │    │
│  │  :3001                                                   │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │  App Router (src/app/)                             │  │    │
│  │  │  ├── layout.tsx (Root layout, providers)          │  │    │
│  │  │  ├── page.tsx (Landing page)                       │  │    │
│  │  │  ├── dashboard/ (Main dashboard)                   │  │    │
│  │  │  ├── api/ (Frontend API routes)                    │  │    │
│  │  │  └── ... (Other pages)                              │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │  Components (src/components/)                      │  │    │
│  │  │  ├── ui/ (Radix UI primitives)                     │  │    │
│  │  │  ├── custom/ (Custom components)                   │  │    │
│  │  │  └── theme/ (Theme provider)                       │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │  Libraries (src/lib/)                              │  │    │
│  │  │  ├── utils.ts (Utility functions)                  │  │    │
│  │  │  ├── api-client.ts (API client)                    │  │    │
│  │  │  └── ... (Other utilities)                         │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Backend (Next.js API Routes)           │    │
│  │  :3001 (Same process, /api/* routes)                     │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │  API Routes (src/app/api/)                         │  │    │
│  │  │  ├── auth/ (Login, status)                         │  │    │
│  │  │  ├── academic/ (Attendance, marks, grades)         │  │    │
│  │  │  ├── hostel/ (Mess, leave, hostel info)            │  │    │
│  │  │  ├── payments/ (Fee dues, receipts, wallet)        │  │    │
│  │  │  ├── library/ (KOHA integration)                   │  │    │
│  │  │  ├── transport/ (Buses, dayboarder)                │  │    │
│  │  │  ├── events/ (EventHub, clubs)                     │  │    │
│  │  │  ├── lms/ (Moodle assignments)                     │  │    │
│  │  │  ├── exams/ (Arrear, makeup, reexam)               │  │    │
│  │  │  ├── research/ (Faculty, projects)                 │  │    │
│  │  │  └── admin/ (Admin endpoints)                      │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ PostgreSQL  │  │   VTOP      │  │   KOHA      │              │
│  │ (Supabase)  │  │  (Scraping) │  │  Library    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Backblaze  │  │   SMTP      │  │  Moodle     │              │
│  │   B2        │  │   Email     │  │   LMS       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. Monorepo with Next.js App Router
- Single repository for frontend and backend
- Uses Next.js 16 App Router for both UI and API routes
- Shared TypeScript types between frontend and backend

### 2. VTOP Scraping Proxy Pattern
- Backend acts as a proxy to VIT's VTOP portal
- Handles authentication, session management, and scraping
- Returns clean JSON to frontend
- ~130 POST endpoints for authenticated operations
- ~15 GET endpoints for public data
- ~10 Admin endpoints

### 3. Database-First for Persistent Data
- PostgreSQL (Supabase) for user data, preferences, cached data
- HMAC-SHA256 token-based authentication
- Row-level security where applicable

### 4. Component-Driven Frontend
- Radix UI primitives for accessible components
- Tailwind CSS v4 for styling
- Framer Motion for animations
- Custom theme system (Light/Dark/Midnight)

### 5. PWA-First Approach
- Service worker for offline support
- Push notifications via Web Push API
- Manifest for installability
- Background sync for data

## Data Flow

### Authentication Flow
```
1. User enters credentials on frontend
2. Frontend POST /api/login
3. Backend validates with VTOP
4. Backend creates HMAC token
5. Backend stores session in DB
6. Backend returns token + user data
7. Frontend stores token (localStorage/cookie)
8. Subsequent requests include token
9. Backend validates token on each request
```

### Data Fetching Flow
```
1. Frontend component needs data
2. Calls API client (src/lib/api-client.ts)
3. Client adds auth headers
4. Requests /api/* endpoint
5. Backend validates token
6. Backend checks cache (DB)
7. If stale/missing: scrapes VTOP
8. Backend returns JSON
9. Frontend updates state/UI
```

## Technology Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16 |
| Language | TypeScript | 5.9 |
| Styling | Tailwind CSS | v4 |
| UI Components | Radix UI | Latest |
| Animations | Framer Motion | Latest |
| Charts | Recharts | Latest |
| Database | PostgreSQL | 16 (Supabase) |
| ORM | Raw SQL / Supabase Client | - |
| Scraping | Cheerio + Axios | Latest |
| Cookies | tough-cookie | Latest |
| Testing | Vitest | Latest |
| Linting | ESLint | Latest |

## Scalability Considerations

1. **Stateless API**: Backend API routes are stateless, enabling horizontal scaling
2. **Database Connection Pooling**: Supabase handles connection pooling
3. **Caching Strategy**: Multi-layer caching (DB cache, HTTP cache, SWR/React Query on frontend)
4. **Rate Limiting**: Implemented at API level for VTOP scraping
5. **Background Jobs**: Heavy operations (migrations, sync) run as async jobs

## Security Architecture

- **Authentication**: HMAC-SHA256 tokens with expiration
- **Authorization**: Role-based (student, admin)
- **Data Protection**: Encrypted sensitive fields in DB
- **API Security**: Rate limiting, input validation, CORS
- **Transport**: HTTPS enforced in production
- **Headers**: Security headers via Next.js config

## Related Documentation

- [Frontend Architecture](./frontend.md)
- [Backend Architecture](./backend.md)
- [Database Design](./database.md)
- [Authentication System](./authentication.md)