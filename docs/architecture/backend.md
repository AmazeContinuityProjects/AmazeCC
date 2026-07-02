# Backend Architecture

## Overview

The backend is implemented as Next.js API Routes within the same Next.js 16 application, providing a unified full-stack experience.

## Directory Structure

```
src/app/api/
├── auth/
│   ├── login/route.ts          # POST - User login
│   └── status/route.ts         # GET - Auth status check
├── attendance/
│   ├── route.ts                # GET - Attendance data
│   ├── summary/route.ts        # GET - Attendance summary
│   └── predict/route.ts        # POST - Attendance prediction
├── marks/
│   ├── route.ts                # GET - Marks data
│   └── breakdown/route.ts      # GET - Assessment breakdown
├── grades/
│   ├── route.ts                # GET - Semester grades
│   └── all/route.ts            # GET - All grades history
├── schedule/
│   ├── route.ts                # GET - Class schedule
│   └── timetable/route.ts      # GET - Timetable export
├── calendar/
│   └── route.ts                # GET - Academic calendar
├── hostel/
│   ├── route.ts                # GET - Hostel info
│   ├── leave/route.ts          # POST - Leave application
│   ├── mess-menu/route.ts      # GET - Mess menu
│   └── mess-feedback/route.ts  # POST - Mess feedback
├── payments/
│   ├── route.ts                # GET - Fee dues
│   ├── receipts/route.ts       # GET - Payment receipts
│   ├── wallet/route.ts         # GET - Wallet balance
│   └── online-transfer/route.ts # POST - Online transfer
├── library/
│   ├── koha/
│   │   ├── search/route.ts     # GET - Book search
│   │   ├── login/route.ts      # POST - KOHA login
│   │   └── patron/route.ts     # GET - Patron info
│   └── due/route.ts            # GET - Library dues
├── transport/
│   ├── buses/route.ts          # GET - Bus routes
│   ├── transport/route.ts      # GET - Transport info
│   └── dayboarder/route.ts     # GET - Day boarder info
├── events/
│   ├── route.ts                # GET - Events list
│   ├── profile/route.ts        # GET - User event profile
│   └── clubs/
│       └── details/route.ts    # GET - Club details
├── lms/
│   ├── route.ts                # GET - LMS data
│   └── assignments/route.ts    # GET - Assignments
├── exams/
│   ├── arrear/route.ts         # GET - Arrear details
│   ├── makeup/route.ts         # GET - Makeup exams
│   ├── compre/route.ts         # GET - Comprehensive exams
│   └── reexam/route.ts         # GET - Re-exams
├── research/
│   ├── faculty/route.ts        # GET - Faculty info
│   ├── profile/route.ts        # GET - Research profile
│   └── project/route.ts        # GET - Projects
├── profile/
│   ├── student/route.ts        # GET - Student profile
│   ├── images/route.ts         # GET - Profile images
│   └── bank-info/route.ts      # GET - Bank info
├── admin/
│   ├── auth/route.ts           # POST - Admin auth
│   ├── fresher-resources/route.ts # GET/POST - Fresher resources
│   ├── buses/route.ts          # GET/POST - Bus management
│   └── migrate/route.ts        # POST - Data migration
└── health/route.ts             # GET - Health check
```

## Core Concepts

### VTOP Scraping Engine

The backend acts as a proxy to VIT's VTOP portal:

```typescript
// Simplified flow in each API route
export async function POST(request: NextRequest) {
  // 1. Validate authentication token
  const token = await validateToken(request)
  
  // 2. Get or create VTOP session
  const session = await getVTopsession(token)
  
  // 3. Scrape required data
  const data = await scrapeVTOP(session, endpoint)
  
  // 4. Transform & cache
  const transformed = transformData(data)
  await cacheData(token.userId, transformed)
  
  // 5. Return JSON response
  return NextResponse.json(transformed)
}
```

### Session Management

- **Cookie Jar**: `tough-cookie` for persistent VTOP sessions
- **Session Pool**: Reuse sessions per user to avoid re-login
- **Auto-renewal**: Refresh sessions before expiry
- **Concurrency**: Handle multiple simultaneous requests

### Database Layer (Supabase/PostgreSQL)

```sql
-- Key tables
users (id, reg_no, name, email, token_hash, created_at)
sessions (id, user_id, vtop_cookies, expires_at)
cached_data (id, user_id, endpoint, data, updated_at)
preferences (user_id, theme, accent, notifications)
attendance_history (user_id, subject, percentage, date)
marks_history (user_id, subject, assessment, marks, date)
```

## API Design Patterns

### Request Validation
```typescript
// Zod schema validation
const loginSchema = z.object({
  regNo: z.string().regex(/^\d{2}[A-Z]{3}\d{4}$/),
  password: z.string().min(1),
  captcha: z.string().length(6)
})
```

### Error Handling
```typescript
// Standardized error responses
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": {} // Optional
}

// HTTP Status Codes
200 - Success
400 - Bad Request (validation)
401 - Unauthorized (invalid/expired token)
403 - Forbidden (admin only)
404 - Not Found
429 - Rate Limited
500 - Internal Server Error
503 - VTOP Unavailable
```

### Rate Limiting
```typescript
// Per-user rate limiting
const limiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 30, // 30 requests per minute
  keyGenerator: (req) => req.user.id
})
```

## Authentication System

### Token Generation (HMAC-SHA256)
```typescript
function generateToken(userId: string): string {
  const payload = { userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }
  const signature = hmacSha256(JSON.stringify(payload), SECRET_KEY)
  return btoa(JSON.stringify(payload)) + '.' + signature
}

function validateToken(token: string): TokenPayload | null {
  const [payloadB64, signature] = token.split('.')
  const payload = JSON.parse(atob(payloadB64))
  
  if (Date.now() > payload.exp) return null
  if (hmacSha256(payloadB64, SECRET_KEY) !== signature) return null
  
  return payload
}
```

### Token Storage
- **Frontend**: localStorage (persistent) + memory (current session)
- **Backend**: Hashed in database for revocation capability
- **Expiration**: 7 days, refreshed on activity

## Caching Strategy

### Multi-Layer Caching
1. **Database Cache**: Persistent, survives restarts
2. **In-Memory Cache**: Hot data for current requests
3. **HTTP Cache**: `Cache-Control` headers for GET endpoints
4. **Frontend Cache**: SWR/React Query with stale-while-revalidate

### Cache Invalidation
- **Time-based**: Configurable TTL per endpoint (default 5 min)
- **Event-based**: Invalidate on user action (leave apply, payment)
- **Manual**: Admin endpoint for forced refresh

## Background Jobs

### Cron Jobs (Vercel Cron / Supabase pg_cron)
- **Daily**: Attendance sync, grade updates
- **Hourly**: Mess menu fetch, event updates
- **Weekly**: Database cleanup, analytics aggregation

### Queue System
- **BullMQ** (Redis) or **Supabase Edge Functions**
- Jobs: Bulk scraping, report generation, notifications

## Scraping Utilities

### Cheerio Selectors
```typescript
// Robust selectors with fallbacks
const selectors = {
  attendanceTable: '#attendanceTable, table[id*="attendance"]',
  marksTable: '#marksTable, table[id*="marks"]',
  // ...
}
```

### Error Recovery
- Retry with exponential backoff
- Captcha solving integration
- Session refresh on 401
- Graceful degradation (return cached data)

## Admin Endpoints

### Authentication
- Separate admin token (env variable `ADMIN_TOKEN`)
- Role-based access control
- Audit logging for admin actions

### Capabilities
- User management (view, suspend)
- Bus route management
- Fresher resources CRUD
- Data migration triggers
- System health monitoring

## Monitoring & Observability

### Logging
```typescript
// Structured logging
logger.info('API Request', {
  endpoint: '/api/attendance',
  userId: '21BCE1234',
  duration: 1250,
  cached: true
})
```

### Metrics
- Request latency (p50, p95, p99)
- Error rates by endpoint
- VTOP availability
- Cache hit ratios
- Active users

### Alerting
- VTOP downtime > 5 min
- Error rate > 5%
- Latency p99 > 10s
- Database connection pool exhaustion

## Related Documentation

- [API Overview](../api/overview.md)
- [Database Design](./database.md)
- [Authentication System](./authentication.md)
- [Deployment Guide](../../deployment/backend.md)