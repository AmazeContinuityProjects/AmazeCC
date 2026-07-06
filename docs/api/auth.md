# Authentication Endpoints

## POST /api/auth/login

Authenticate with VTOP credentials and receive access token.

### Request
```json
{
  "regNo": "21BCE1234",
  "password": "your_vtop_password",
  "captcha": "A1B2C3"
}
```

### Response (200)
```json
{
  "data": {
    "token": "eyJ1c2VySWQiOiI...HMAC_SIGNATURE",
    "user": {
      "id": "uuid",
      "regNo": "21BCE1234",
      "name": "JOHN DOE",
      "email": "john.doe2021@vitstudent.ac.in",
      "phone": "9876543210",
      "campus": "Chennai",
      "school": "SCOPE",
      "program": "B.Tech Computer Science and Engineering",
      "batch": "2021-2025",
      "section": "A"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Errors
| Code | Status | Cause |
|------|--------|-------|
| `INVALID_CREDENTIALS` | 401 | Wrong registration number or password |
| `INVALID_CAPTCHA` | 400 | Captcha text doesn't match |
| `VTOP_UNAVAILABLE` | 503 | VTOP portal not responding |
| `CAPTCHA_FAILED` | 500 | Captcha solving service failed |
| `RATE_LIMITED` | 429 | Too many login attempts |

---

## GET /api/auth/status

Check current authentication status.

### Request
```
Authorization: Bearer <token>
```

### Response (200)
```json
{
  "data": {
    "authenticated": true,
    "user": {
      "id": "uuid",
      "regNo": "21BCE1234",
      "name": "JOHN DOE"
    },
    "tokenExpiresAt": "2024-01-22T10:30:00Z"
  }
}
```

### Response (401)
```json
{
  "error": "TOKEN_EXPIRED",
  "message": "Authentication token has expired"
}
```

---

## POST /api/auth/refresh

Refresh access token using refresh token.

### Request
```
Authorization: Bearer <refresh_token>
```
Or cookie-based (HttpOnly refresh token cookie)

### Response (200)
```json
{
  "data": {
    "token": "new_access_token",
    "expiresAt": "2024-01-22T10:30:00Z"
  }
}
```

---

## POST /api/auth/logout

Invalidate current session.

### Request
```
Authorization: Bearer <token>
```

### Response (200)
```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## GET /api/auth/captcha

Get a fresh captcha image for login.

### Response (200)
```json
{
  "data": {
    "captchaId": "uuid",
    "image": "base64_encoded_png",
    "expiresAt": "2024-01-15T10:35:00Z"
  }
}
```

### Usage
1. Call this endpoint to get captcha
2. Display image to user (or solve programmatically)
3. Include `captchaId` and solution in login request

---

## Error Codes Reference

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `INVALID_CREDENTIALS` | 401 | Wrong reg no/password | Verify credentials |
| `INVALID_CAPTCHA` | 400 | Captcha mismatch | Retry with new captcha |
| `VTOP_UNAVAILABLE` | 503 | VTOP portal down | Wait and retry |
| `TOKEN_EXPIRED` | 401 | Access token expired | Use refresh token |
| `TOKEN_INVALID` | 401 | Signature mismatch | Re-login |
| `TOKEN_REVOKED` | 401 | Token invalidated server-side | Re-login |
| `SESSION_EXPIRED` | 401 | VTOP session expired | Re-login (auto-handled) |
| `RATE_LIMITED` | 429 | Too many requests | Wait before retry |

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login` | 5 | 1 minute |
| `/api/auth/captcha` | 10 | 1 minute |
| `/api/auth/refresh` | 10 | 1 minute |
| `/api/auth/status` | 60 | 1 minute |

## Related Documentation

- [API Overview](../overview.md)
- [Authentication Architecture](../../architecture/authentication.md)
- [Security Overview](../../security/overview.md)