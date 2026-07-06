# Hostel Endpoints

## GET /api/hostel
Get hostel information for the logged-in student.

**Response (200):**
```json
{
  "data": {
    "hostelName": "GH - Block A",
    "roomNumber": "A-304",
    "floor": 3,
    "block": "A",
    "roomType": "Triple Sharing",
    "roommates": [
      { "regNo": "21BCE1235", "name": "JANE DOE" },
      { "regNo": "21BCE1236", "name": "BOB SMITH" }
    ],
    "warden": "Mr. Johnson",
    "wardenContact": "9876543210",
    "messType": "Veg + Non-Veg",
    "laundryAvailable": true,
    "gymAvailable": true
  }
}
```

---

## POST /api/hostel/leave
Apply for hostel leave.

**Request:**
```json
{
  "leaveType": "OUT_STATION",
  "fromDate": "2024-02-10",
  "toDate": "2024-02-15",
  "reason": "Family function",
  "destination": "Chennai",
  "contactNumber": "9876543210",
  "parentContact": "9876500000",
  "emergencyContact": "9876511111"
}
```

**Leave Types:**
- `OUT_STATION` - Leaving campus
- `NIGHT_STAY` - Night stay in another hostel
- `MEDICAL` - Medical leave
- `ACADEMIC` - Academic event (OD)

**Response (200):**
```json
{
  "data": {
    "leaveId": "LV_20240115_001",
    "status": "PENDING_APPROVAL",
    "submittedAt": "2024-01-15T10:30:00Z",
    "estimatedApproval": "2024-01-15T18:00:00Z"
  }
}
```

**Response (400):**
```json
{
  "error": "INVALID_DATES",
  "message": "To date must be after from date"
}
```

---

## GET /api/hostel/mess-menu
Get mess menu for current/upcoming days.

**Query Parameters:**
- `date` (optional): Specific date (YYYY-MM-DD)
- `days` (optional): Number of days ahead (default 7)

**Response (200):**
```json
{
  "data": [
    {
      "date": "2024-01-15",
      "day": "MONDAY",
      "breakfast": [
        "Idli", "Sambar", "Coconut Chutney", "Coffee/Tea"
      ],
      "lunch": [
        "Rice", "Sambar", "Vegetable Kurma", "Curd", "Pickle", "Papad"
      ],
      "snacks": [
        "Bajji", "Tea/Coffee"
      ],
      "dinner": [
        "Chapati", "Dal Makhani", "Aloo Gobi", "Raita", "Sweet"
      ],
      "specialNote": "North Indian Special"
    }
  ]
}
```

---

## POST /api/hostel/mess-feedback
Submit mess feedback.

**Request:**
```json
{
  "date": "2024-01-15",
  "mealType": "LUNCH",
  "rating": 4,
  "comments": "Good variety but dal was cold",
  "categories": {
    "taste": 4,
    "variety": 5,
    "temperature": 2,
    "hygiene": 5,
    "service": 4
  }
}
```

**Response (200):**
```json
{
  "data": {
    "feedbackId": "FB_20240115_001",
    "status": "SUBMITTED",
    "message": "Thank you for your feedback!"
  }
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid request (dates, missing fields) |
| 401 | Unauthorized |
| 403 | Not a hostel resident |
| 409 | Leave overlap / Already applied |
| 422 | Leave quota exceeded |
| 503 | Hostel portal unavailable |

## Leave Status Flow

```
SUBMITTED → PENDING_WARDEN → APPROVED/REJECTED
                ↓
         PENDING_PARENT (if outstation)
                ↓
           APPROVED/REJECTED
```

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)