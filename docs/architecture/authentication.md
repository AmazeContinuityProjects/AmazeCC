# Authentication System

## Overview

AmazeCC uses a custom HMAC-SHA256 token-based authentication system with VTOP (VIT's portal) as the identity provider.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│    VTOP     │
│             │     │  (API)      │     │  (Identity) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       │ 1. Credentials    │ 2. Validate        │
       │──────────────────▶│───────────────────▶│
       │                   │ 3. Create Session  │
       │                   │◀───────────────────│
       │ 4. HMAC Token     │                    │
       │◀──────────────────│                    │
       │                   │                    │
       │ 5. API Requests   │ 6. Validate Token  │
       │──────────────────▶│ (per request)      │
       │◀──────────────────│                    │
```

## Token Format

### Structure
```
<base64(payload)>.<base64(signature)>
```

### Payload
```json
{
  "userId": "uuid",
  "regNo": "21BCE1234",
  "iat": 1699900000,
  "exp": 1700504800
}
```

### Signature
```
HMAC-SHA256(base64(payload), SECRET_KEY)
```

## Flow Details

### 1. Login (`POST /api/auth/login`)

**Request:**
```json
{
  "regNo": "21BCE1234",
  "password": "********",
  "captcha": "A1B2C3"
}
```

**Backend Process:**
1. Validate captcha via VTOP
2. Submit credentials to VTOP login endpoint
3. Parse VTOP response for success/failure
4. On success: Extract student info from VTOP
5. Create/update user in database
6. Generate HMAC token
7. Create VTOP session (store cookies)
8. Return token + user data

**Response:**
```json
{
  "token": "eyJ1c2VySWQiOiJ...signature",
  "user": {
    "id": "uuid",
    "regNo": "21BCE1234",
    "name": "John Doe",
    "email": "john@vitstudent.ac.in",
    "campus": "Chennai",
    "school": "SCOPE",
    "program": "B.Tech CSE",
    "batch": "2021-2025",
    "section": "A"
  }
}
```

### 2. Token Validation (Middleware)

Every authenticated request passes through validation:

```typescript
async function validateAuth(request: NextRequest): Promise<TokenPayload | null> {
  // Extract token from Authorization header or cookie
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    || request.cookies.get('auth_token')?.value
  
  if (!token) return null
  
  // Verify signature
  const [payloadB64, signature] = token.split('.')
  if (!payloadB64 || !signature) return null
  
  const expectedSignature = hmacSha256(payloadB64, SECRET_KEY)
  if (signature !== expectedSignature) return null
  
  // Parse payload
  const payload = JSON.parse(atob(payloadB64))
  
  // Check expiration
  if (Date.now() > payload.exp) return null
  
  // Optional: Check against database for revocation
  const user = await db.users.findUnique({ where: { id: payload.userId } })
  if (!user || user.tokenHash !== hashToken(token)) return null
  
  return payload
}
```

### 3. Session Management

#### VTOP Session
- Stored in `sessions` table with encrypted cookies
- Reused across API calls to avoid re-login
- Refreshed proactively before expiry
- Invalidated on password change / logout

#### Application Session
- HMAC token (7-day expiry)
- Refresh token (30-day expiry, stored hashed in DB)
- Automatic token refresh on API calls

### 4. Logout

**Frontend:**
- Clear localStorage/cookies
- Redirect to login

**Backend (`POST /api/auth/logout`):**
- Invalidate token in database
- Delete VTOP session
- Clear cookies

## Security Measures

### Token Security
- **Algorithm**: HMAC-SHA256 (not JWT - simpler, no algorithm confusion)
- **Key**: 256-bit secret from environment variable
- **Expiration**: Short-lived (7 days), with refresh tokens
- **Rotation**: New token on each login, old invalidated

### Transport Security
- **HTTPS Only**: Secure cookies in production
- **SameSite**: `Lax` for auth cookies
- **HttpOnly**: Prevents XSS token theft
- **CSP**: Content Security Policy headers

### Brute Force Protection
- Rate limiting on `/api/auth/login` (5 attempts/minute)
- Captcha required for login
- Account lockout after 10 failed attempts (15 min)

### Session Security
- **Encryption**: VTOP cookies encrypted at rest (AES-256-GCM)
- **Rotation**: Session IDs rotated on privilege change
- **Concurrency**: Max 3 concurrent sessions per user

## Admin Authentication

Separate system for admin panel:
- **Token**: `ADMIN_TOKEN` environment variable
- **Header**: `X-Admin-Token: <token>`
- **Roles**: Super admin, content moderator, support
- **Audit**: All admin actions logged

## Frontend Integration

### Auth Context
```typescript
// src/contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null
  token: string | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  isLoading: boolean
}
```

### API Client
```typescript
// src/lib/api-client.ts
class ApiClient {
  private token: string | null = null
  
  setToken(token: string) { this.token = token }
  
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers)
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`)
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include' // For cookies
    })
    
    if (response.status === 401) {
      await this.handleUnauthorized()
      throw new AuthError('Session expired')
    }
    
    return response.json()
  }
}
```

## Token Refresh Flow

```
1. API returns 401
2. Frontend calls POST /api/auth/refresh
3. Backend validates refresh token
4. Backend issues new access token
5. Frontend retries original request
```

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong reg no/password |
| `INVALID_CAPTCHA` | 400 | Captcha mismatch |
| `VTOP_UNAVAILABLE` | 503 | VTOP portal down |
| `TOKEN_EXPIRED` | 401 | Token past expiry |
| `TOKEN_INVALID` | 401 | Signature mismatch |
| `TOKEN_REVOKED` | 401 | Token invalidated (logout/password change) |
| `SESSION_EXPIRED` | 401 | VTOP session expired |
| `RATE_LIMITED` | 429 | Too many attempts |

## Related Documentation

- [Backend Architecture](./backend.md)
- [Database Design](./database.md)
- [API Auth Endpoints](../api/auth.md)
- [Security Overview](../security/overview.md)