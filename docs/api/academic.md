# Academic Endpoints

## Attendance

### GET /api/attendance
Get attendance data for all subjects.

**Query Parameters:**
- `semester` (optional): Filter by semester
- `force_refresh` (optional): Bypass cache

**Response (200):**
```json
{
  "data": [
    {
      "subjectCode": "CSE2001",
      "subjectName": "Data Structures and Algorithms",
      "faculty": "Dr. Smith",
      "category": "THEORY",
      "slot": "A1",
      "attended": 42,
      "total": 45,
      "percentage": 93.33,
      "status": "SAFE",
      "lastUpdated": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "semester": "2024-25 Odd",
    "overallPercentage": 87.5,
    "totalClasses": 320,
    "attendedClasses": 280,
    "lastSync": "2024-01-15T10:30:00Z"
  }
}
```

### GET /api/attendance/summary
Get attendance summary with predictions.

**Response (200):**
```json
{
  "data": {
    "overall": {
      "percentage": 87.5,
      "status": "SAFE",
      "classesToAttendFor75": 0,
      "classesToAttendFor85": 5,
      "classesToAttendFor90": 12
    },
    "bySubject": [
      {
        "subjectCode": "CSE2001",
        "percentage": 93.33,
        "status": "SAFE",
        "bunksAllowed": 3
      }
    ],
    "riskSubjects": [
      {
        "subjectCode": "MAT2001",
        "percentage": 72.5,
        "status": "RISK",
        "classesNeeded": 4
      }
    ]
  }
}
```

### POST /api/attendance/predict
Predict attendance based on future classes.

**Request:**
```json
{
  "subjectCode": "CSE2001",
  "futureClasses": 10,
  "assumedAttendance": 80
}
```

**Response (200):**
```json
{
  "data": {
    "currentPercentage": 93.33,
    "predictedPercentage": 91.2,
    "willStayAbove75": true,
    "willStayAbove85": true
  }
}
```

---

## Marks

### GET /api/marks
Get marks for all assessments.

**Query Parameters:**
- `semester` (optional): Filter by semester
- `subjectCode` (optional): Filter by subject

**Response (200):**
```json
{
  "data": [
    {
      "subjectCode": "CSE2001",
      "subjectName": "Data Structures and Algorithms",
      "assessments": [
        {
          "name": "CAT 1",
          "type": "CAT",
          "maxMarks": 50,
          "obtainedMarks": 45,
          "weightage": 20,
          "date": "2024-02-15"
        },
        {
          "name": "FAT",
          "type": "FAT",
          "maxMarks": 100,
          "obtainedMarks": 88,
          "weightage": 50,
          "date": "2024-04-20"
        }
      ],
      "totalObtained": 133,
      "totalMax": 150,
      "percentage": 88.67,
      "grade": "A",
      "lastUpdated": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### GET /api/marks/breakdown
Get detailed assessment breakdown per subject.

---

## Grades

### GET /api/grades
Get semester-wise grades.

**Response (200):**
```json
{
  "data": [
    {
      "semester": "2024-25 Odd",
      "subjects": [
        {
          "subjectCode": "CSE2001",
          "subjectName": "Data Structures and Algorithms",
          "credits": 4,
          "grade": "A",
          "gradePoints": 9,
          "category": "PC"
        }
      ],
      "sgpa": 8.75,
      "cgpa": 8.92,
      "totalCredits": 24,
      "earnedCredits": 24
    }
  ]
}
```

### GET /api/grades/all
Get complete grade history across all semesters.

---

## Schedule

### GET /api/schedule
Get class schedule/timetable.

**Query Parameters:**
- `semester` (optional)
- `format` (optional): `json`, `ical`, `csv`

**Response (200):**
```json
{
  "data": {
    "semester": "2024-25 Odd",
    "timetable": [
      {
        "day": "MONDAY",
        "slots": [
          {
            "slot": "A1",
            "time": "08:00-08:55",
            "subjectCode": "CSE2001",
            "subjectName": "Data Structures",
            "faculty": "Dr. Smith",
            "room": "TT101",
            "type": "THEORY"
          }
        ]
      }
    ],
    "exportUrl": "/api/schedule/timetable?format=ical"
  }
}
```

---

## Calendar

### GET /api/calendar
Get academic calendar events.

**Response (200):**
```json
{
  "data": [
    {
      "id": "evt_001",
      "title": "CAT 1 Exams",
      "description": "Continuous Assessment Test 1",
      "startDate": "2024-02-10",
      "endDate": "2024-02-17",
      "type": "EXAM",
      "category": "ACADEMIC"
    },
    {
      "id": "evt_002",
      "title": "Tech Fest",
      "description": "Annual Technical Festival",
      "startDate": "2024-03-15",
      "endDate": "2024-03-17",
      "type": "EVENT",
      "category": "CULTURAL"
    }
  ]
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid query parameters |
| 401 | Unauthorized / Token expired |
| 404 | Semester/data not found |
| 503 | VTOP unavailable |
| 504 | VTOP timeout |

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)
- [Architecture: Academic Data Flow](../../architecture/backend.md#data-fetching-flow)