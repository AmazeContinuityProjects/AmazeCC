# Events Endpoints

## GET /api/events
Get events from EventHub.

**Query Parameters:**
- `type` (optional): `upcoming`, `ongoing`, `past`, `featured`, `all` (default: `upcoming`)
- `club` (optional): Filter by club name
- `category` (optional): `technical`, `cultural`, `sports`, `academic`, `social`
- `limit` (optional): Results per page (default 20)
- `page` (optional): Page number

**Response (200):**
```json
{
  "data": [
    {
      "eventId": "EVT_2024_001",
      "title": "HackVIT 2024",
      "description": "Annual 36-hour hackathon...",
      "clubName": "CSE Association",
      "clubLogo": "https://cdn.amazecc.com/clubs/cse.png",
      "venue": "TT Block, VIT Chennai",
      "startTime": "2024-02-10T09:00:00Z",
      "endTime": "2024-02-11T21:00:00Z",
      "registrationUrl": "https://events.vit.ac.in/hackvit2024",
      "imageUrl": "https://cdn.amazecc.com/events/hackvit2024.jpg",
      "isFeatured": true,
      "tags": ["hackathon", "coding", "prizes", "team"],
      "registrationCount": 342,
      "maxParticipants": 500,
      "registrationOpen": true,
      "registrationDeadline": "2024-02-05T23:59:59Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

## GET /api/events/profile
Get user's event registrations and history.

**Response (200):**
```json
{
  "data": {
    "upcoming": [
      {
        "eventId": "EVT_2024_001",
        "title": "HackVIT 2024",
        "startTime": "2024-02-10T09:00:00Z",
        "venue": "TT Block",
        "registrationStatus": "CONFIRMED",
        "qrCode": "data:image/png;base64,..."
      }
    ],
    "past": [
      {
        "eventId": "EVT_2023_050",
        "title": "Tech Fest 2023",
        "date": "2023-09-15",
        "attended": true,
        "certificateUrl": "https://certificates.vit.ac.in/EVT_2023_050_21BCE1234.pdf"
      }
    ],
    "stats": {
      "totalRegistered": 12,
      "totalAttended": 8,
      "certificatesEarned": 5
    }
  }
}
```

---

## GET /api/events/clubs/details
Get club information.

**Query Parameters:**
- `clubId` (optional): Specific club
- `category` (optional): Filter by category

**Response (200):**
```json
{
  "data": [
    {
      "clubId": "CLB_CSE",
      "name": "CSE Association",
      "description": "Official Computer Science Engineering Association",
      "logo": "https://cdn.amazecc.com/clubs/cse.png",
      "banner": "https://cdn.amazecc.com/clubs/cse_banner.jpg",
      "category": "TECHNICAL",
      "tags": ["coding", "workshops", "hackathons", "tech-talks"],
      "socialLinks": {
        "instagram": "https://instagram.com/csevit",
        "linkedin": "https://linkedin.com/company/cse-vit",
        "website": "https://cse.vit.ac.in"
      },
      "president": "Jane Smith (21BCE5678)",
      "memberCount": 1250,
      "isOfficial": true,
      "upcomingEventsCount": 5
    }
  ]
}
```

---

## POST /api/events/register
Register for an event.

**Request:**
```json
{
  "eventId": "EVT_2024_001",
  "teamMembers": ["21BCE5678", "21BCE9012"],  // Optional for team events
  "answers": {                                // Optional custom questions
    "tshirtSize": "L",
    "dietaryRestrictions": "Vegetarian"
  }
}
```

**Response (200):**
```json
{
  "data": {
    "registrationId": "REG_20240115_001",
    "eventId": "EVT_2024_001",
    "status": "CONFIRMED",
    "registeredAt": "2024-01-15T10:30:00Z",
    "qrCode": "data:image/png;base64,...",
    "confirmationEmail": "sent"
  }
}
```

**Response (409):**
```json
{
  "error": "ALREADY_REGISTERED",
  "message": "You are already registered for this event"
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid event ID, registration closed |
| 401 | Unauthorized |
| 404 | Event not found |
| 409 | Already registered / Event full |
| 422 | Team size mismatch / Invalid answers |

---

## Event Categories

| Category | Description |
|----------|-------------|
| `TECHNICAL` | Coding, hackathons, workshops |
| `CULTURAL` | Music, dance, arts, fashion |
| `SPORTS` | Tournaments, fitness, adventure |
| `ACADEMIC` | Seminars, conferences, symposiums |
| `SOCIAL` | Networking, mixers, community service |

---

## Registration Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting approval (if required) |
| `CONFIRMED` | Registration confirmed |
| `WAITLISTED` | On waiting list |
| `CANCELLED` | Cancelled by user |
| `REJECTED` | Rejected by organizers |
| `ATTENDED` | Marked as attended |
| `NO_SHOW` | Registered but didn't attend |

---

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)