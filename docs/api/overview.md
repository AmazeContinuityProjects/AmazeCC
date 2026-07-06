# API Overview

## Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://api.amazecc.com` |
| Development | `http://localhost:3001` |
| Self-hosted | Configure via `NEXT_PUBLIC_API_URL` |

## Conventions

### HTTP Methods
- `GET` - Retrieve data
- `POST` - Create/trigger actions
- `PUT` - Full update
- `PATCH` - Partial update
- `DELETE` - Remove resource

### Headers
```
Content-Type: application/json
Authorization: Bearer <token>        # For authenticated endpoints
X-Admin-Token: <admin_token>        # For admin endpoints
Accept: application/json
```

### Response Format

**Success:**
```json
{
  "data": { ... },
  "meta": { "cached": true, "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Error:**
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable description",
  "details": { "field": "regNo", "issue": "Invalid format" }
}
```

### Pagination
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Rate Limiting
- **Authenticated**: 60 requests/minute per user
- **Public**: 20 requests/minute per IP
- **Admin**: 200 requests/minute
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Authentication

All endpoints except public ones require authentication via HMAC token.

### Token Acquisition
```bash
POST /api/auth/login
Content-Type: application/json

{
  "regNo": "21BCE1234",
  "password": "your_password",
  "captcha": "A1B2C3"
}
```

### Using Token
```bash
curl -H "Authorization: Bearer <token>" \
  https://api.amazecc.com/api/attendance
```

## Endpoint Categories

| Category | Prefix | Auth Required | Description |
|----------|--------|---------------|-------------|
| Auth | `/api/auth/*` | No | Login, status, refresh |
| Academic | `/api/attendance`, `/api/marks`, `/api/grades`, `/api/schedule`, `/api/calendar` | Yes | Core academic data |
| Hostel | `/api/hostel/*` | Yes | Hostel info, leave, mess |
| Payments | `/api/payments/*` | Yes | Fee dues, receipts, wallet |
| Library | `/api/library/*` | Yes | KOHA search, dues |
| Transport | `/api/transport/*` | Yes | Bus routes, day boarder |
| Events | `/api/events/*` | Yes | EventHub, clubs |
| LMS | `/api/lms/*` | Yes | Moodle assignments |
| Exams | `/api/exams/*` | Yes | Arrear, makeup, reexam |
| Research | `/api/research/*` | Yes | Faculty, projects |
| Profile | `/api/profile/*` | Yes | Student profile, images |
| Admin | `/api/admin/*` | Admin | Management endpoints |

## Common Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `semester` | string | Filter by semester (e.g., "2024-25 Odd") |
| `force_refresh` | boolean | Bypass cache, scrape fresh |
| `limit` | integer | Pagination limit (default 20, max 100) |
| `offset` | integer | Pagination offset |
| `sort` | string | Sort field |
| `order` | string | `asc` or `desc` |

## Caching

- **Default TTL**: 5 minutes for academic data
- **Longer TTL**: 1 hour for static data (bus routes, events)
- **Cache Headers**: `Cache-Control: public, max-age=300, stale-while-revalidate=600`
- **Force Refresh**: Add `?force_refresh=true` to bypass cache

## Versioning

- Current version: `v1` (implicit, no version in URL)
- Future versions: `/api/v2/...`
- Breaking changes: New version, old maintained 6 months

## Webhooks (Planned)

For real-time updates:
- Attendance changes
- Marks published
- Event registrations
- Payment confirmations

## SDKs & Clients

### TypeScript/JavaScript
```typescript
import { AmazeCCClient } from '@amazecc/api-client'

const client = new AmazeCCClient({
  baseUrl: 'https://api.amazecc.com',
  token: 'your_token'
})

const attendance = await client.academic.getAttendance()
```

### Python
```python
from amazecc import AmazeCCClient

client = AmazeCCClient(token="your_token")
attendance = client.academic.get_attendance()
```

## Testing

### Health Check
```bash
GET /api/health
# Returns 200 OK with version info
```

### Postman Collection
Available at: `https://api.amazecc.com/docs/postman.json`

### OpenAPI/Swagger
Available at: `https://api.amazecc.com/docs` (Swagger UI)

## Related Documentation

- [Auth Endpoints](./auth.md)
- [Academic Endpoints](./academic.md)
- [Hostel Endpoints](./hostel.md)
- [Payment Endpoints](./payments.md)
- [Library Endpoints](./library.md)
- [Transport Endpoints](./transport.md)
- [Events Endpoints](./events.md)
- [LMS Endpoints](./lms.md)
- [Exams Endpoints](./exams.md)
- [Research Endpoints](./research.md)
- [Admin Endpoints](./admin.md)