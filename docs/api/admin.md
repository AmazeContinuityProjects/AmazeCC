# Admin Endpoints

## Authentication

All admin endpoints require `X-Admin-Token` header:
```
X-Admin-Token: <ADMIN_TOKEN>
```

## POST /api/admin/auth
Verify admin credentials.

**Request:**
```json
{
  "token": "admin_secret_token"
}
```

**Response (200):**
```json
{
  "data": {
    "valid": true,
    "role": "SUPER_ADMIN",
    "permissions": ["users", "buses", "fresher-resources", "migrate", "analytics"]
  }
}
```

---

## GET /api/admin/users
List all users (paginated).

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50, max: 200)
- `search` (optional): Search by reg no, name, email
- `status` (optional): `active`, `inactive`, `suspended`
- `campus` (optional): Filter by campus

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "regNo": "21BCE1234",
      "name": "JOHN DOE",
      "email": "john.doe2021@vitstudent.ac.in",
      "campus": "Chennai",
      "school": "SCOPE",
      "isActive": true,
      "isAdmin": false,
      "lastLoginAt": "2024-01-15T08:30:00Z",
      "createdAt": "2021-08-15T10:00:00Z",
      "loginCount": 245
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12500,
    "totalPages": 250
  }
}
```

---

## PATCH /api/admin/users/:userId
Update user status.

**Request:**
```json
{
  "isActive": false,
  "reason": "Policy violation"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "isActive": false,
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## GET /api/admin/fresher-resources
List fresher resources.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "VIT Chennai Campus Map",
      "description": "Interactive campus map with all blocks",
      "category": "CAMPUS",
      "content": {
        "type": "map",
        "url": "https://maps.vit.ac.in/chennai"
      },
      "isPublished": true,
      "createdBy": "admin@amazecc.com",
      "createdAt": "2023-06-15T10:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

---

## POST /api/admin/fresher-resources
Create fresher resource.

**Request:**
```json
{
  "title": "Hostel Rules Guide",
  "description": "Complete guide to hostel rules and regulations",
  "category": "HOSTEL",
  "content": {
    "type": "document",
    "url": "https://cdn.amazecc.com/docs/hostel-rules.pdf",
    "sections": [
      "Check-in Process",
      "Mess Timings",
      "Leave Rules",
      "Disciplinary Actions"
    ]
  },
  "isPublished": true
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    ...request,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## GET /api/admin/buses
List all bus routes.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "routeNumber": "01A",
      "routeName": "Tambaram - VIT Chennai",
      "campus": "Chennai",
      "stops": [
        {"name": "Tambaram Railway Station", "time": "06:30", "lat": 12.9249, "lng": 80.1000},
        {"name": "Chrompet", "time": "06:45", "lat": 12.9516, "lng": 80.1467},
        {"name": "VIT Chennai", "time": "07:30", "lat": 12.8456, "lng": 80.1567}
      ],
      "isAc": false,
      "isActive": true,
      "createdAt": "2023-06-01T00:00:00Z"
    }
  ]
}
```

---

## POST /api/admin/buses
Create/update bus route.

**Request:**
```json
{
  "routeNumber": "01B",
  "routeName": "Tambaram - VIT Chennai (AC)",
  "campus": "Chennai",
  "stops": [...],
  "isAc": true,
  "isActive": true
}
```

---

## POST /api/admin/migrate
Trigger data migration.

**Request:**
```json
{
  "type": "FULL_SYNC",
  "options": {
    "forceRefresh": true,
    "batchSize": 100,
    "semesters": ["2024-25 Odd"]
  }
}
```

**Response (200):**
```json
{
  "data": {
    "jobId": "MIG_20240115_001",
    "status": "STARTED",
    "startedAt": "2024-01-15T10:30:00Z",
    "estimatedDuration": "30 minutes"
  }
}
```

---

## GET /api/admin/migrate/:jobId
Check migration status.

**Response (200):**
```json
{
  "data": {
    "jobId": "MIG_20240115_001",
    "status": "IN_PROGRESS",
    "progress": 45,
    "processed": 5620,
    "total": 12500,
    "errors": 3,
    "startedAt": "2024-01-15T10:30:00Z",
    "estimatedCompletion": "2024-01-15T11:00:00Z"
  }
}
```

---

## GET /api/admin/analytics
System analytics.

**Response (200):**
```json
{
  "data": {
    "users": {
      "total": 12500,
      "activeToday": 3420,
      "activeWeek": 8900,
      "activeMonth": 11200,
      "newThisWeek": 150
    },
    "api": {
      "requestsToday": 450000,
      "avgLatency": 1250,
      "errorRate": 0.02,
      "topEndpoints": [
        { "endpoint": "/api/attendance", "count": 125000 },
        { "endpoint": "/api/marks", "count": 98000 }
      ]
    },
    "vtop": {
      "availability": 99.2,
      "avgResponseTime": 3200,
      "errorsToday": 15
    },
    "database": {
      "connections": 45,
      "cacheHitRate": 0.87,
      "size": "2.3 GB"
    }
  }
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 401 | Invalid/expired admin token |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 422 | Validation error |

---

## Admin Roles

| Role | Permissions |
|------|-------------|
| `SUPER_ADMIN` | All permissions |
| `CONTENT_MODERATOR` | Fresher resources, buses |
| `SUPPORT` | User management (view only) |
| `ANALYST` | Analytics only |

---

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)
- [Security: Admin Access](../../security/api-security.md)