# Transport Endpoints

## GET /api/transport/buses
Get bus routes for all campuses.

**Query Parameters:**
- `campus` (optional): Filter by campus (`chennai`, `vellore`, `bhopal`, `ap`)
- `type` (optional): `ac`, `non-ac`, `all` (default: `all`)

**Response (200):**
```json
{
  "data": [
    {
      "routeNumber": "101A",
      "routeName": "Chennai - Tambaram - VIT",
      "campus": "Chennai",
      "type": "AC",
      "stops": [
        { "name": "Tambaram Railway Station", "time": "06:30", "lat": 12.9249, "lng": 80.1206 },
        { "name": "Chromepet", "time": "06:45", "lat": 12.9516, "lng": 80.1462 },
        { "name": "VIT Chennai Campus", "time": "07:30", "lat": 12.8406, "lng": 80.1537 }
      ],
      "schedule": {
        "weekday": ["06:30", "07:30", "08:30", "16:30", "17:30", "18:30"],
        "saturday": ["07:00", "08:00", "15:00", "16:00"],
        "sunday": ["08:00", "14:00"]
      },
      "fare": 45,
      "isActive": true
    }
  ]
}
```

---

## GET /api/transport/transport
Get student's transport allocation.

**Response (200):**
```json
{
  "data": {
    "hasTransport": true,
    "routeNumber": "101A",
    "routeName": "Chennai - Tambaram - VIT",
    "stopName": "Chromepet",
    "pickupTime": "06:45",
    "dropTime": "18:15",
    "busNumber": "TN-XX-XXXX",
    "driverName": "R. Kumar",
    "driverContact": "9876543210",
    "conductorName": "S. Murugan",
    "conductorContact": "9876543211",
    "validTill": "2025-04-30",
    "feePaid": true
  }
}
```

---

## GET /api/transport/dayboarder
Get day boarder (day scholar) information.

**Response (200):**
```json
{
  "data": {
    "isDayBoarder": true,
    "campus": "Chennai",
    "homeAddress": "No. 123, Gandhi Road, Chromepet, Chennai - 600044",
    "pincode": "600044",
    "distanceFromCampus": "12.5 km",
    "estimatedCommute": "45 min",
    "preferredRoute": "101A",
    "alternateRoutes": ["101B", "202"]
  }
}
```

---

## POST /api/transport/bus-tracking
Get real-time bus location (if available).

**Request:**
```json
{
  "routeNumber": "101A"
}
```

**Response (200):**
```json
{
  "data": {
    "routeNumber": "101A",
    "busNumber": "TN-XX-XXXX",
    "currentLocation": {
      "lat": 12.9400,
      "lng": 80.1400
    },
    "nextStop": "Chromepet",
    "eta": "5 min",
    "speed": 35,
    "heading": "North",
    "lastUpdated": "2024-01-15T07:45:00Z",
    "isTracking": true
  }
}
```

**Response (404):**
```json
{
  "error": "TRACKING_UNAVAILABLE",
  "message": "GPS tracking not available for this bus"
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 401 | Unauthorized |
| 403 | No transport allocated |
| 404 | Route/bus not found |
| 503 | Transport portal unavailable |

---

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)