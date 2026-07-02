# LMS Endpoints

## GET /api/lms-data
Get LMS (Moodle) course data.

**Query Parameters:**
- `semester` (optional): Filter by semester

**Response (200):**
```json
{
  "data": [
    {
      "courseId": "CSE2001_2024_ODD",
      "courseCode": "CSE2001",
      "courseName": "Data Structures and Algorithms",
      "instructor": "Dr. Smith",
      "category": "PC",
      "credits": 4,
      "progress": 65,
      "lastAccessed": "2024-01-10T14:30:00Z",
      "assignmentsCount": 8,
      "completedAssignments": 5,
      "quizzesCount": 4,
      "completedQuizzes": 3,
      "currentGrade": "A-"
    }
  ]
}
```

---

## GET /api/lms-data/assignments
Get assignments across all courses.

**Query Parameters:**
- `courseId` (optional): Filter by course
- `status` (optional): `pending`, `submitted`, `graded`, `overdue`, `all` (default: `pending`)
- `days` (optional): Upcoming within N days (default: 30)

**Response (200):**
```json
{
  "data": [
    {
      "assignmentId": "ASG_CSE2001_001",
      "courseId": "CSE2001_2024_ODD",
      "courseCode": "CSE2001",
      "courseName": "Data Structures and Algorithms",
      "title": "Assignment 3: Graph Algorithms",
      "description": "Implement Dijkstra's and A* algorithms...",
      "type": "PROGRAMMING",
      "maxMarks": 50,
      "weightage": 10,
      "issuedDate": "2024-01-08",
      "dueDate": "2024-01-22T23:59:00Z",
      "status": "PENDING",
      "submissionUrl": "https://moodle.vit.ac.in/mod/assign/view.php?id=12345",
      "allowLateSubmission": true,
      "latePenalty": "10% per day",
      "attachments": [
        {
          "name": "assignment3_spec.pdf",
          "url": "https://moodle.vit.ac.in/pluginfile.php/.../assignment3_spec.pdf"
        }
      ]
    }
  ],
  "meta": {
    "totalPending": 3,
    "totalOverdue": 0,
    "upcomingCount": 5
  }
}
```

---

## GET /api/lms-data/quizzes
Get quiz information.

**Response (200):**
```json
{
  "data": [
    {
      "quizId": "QUIZ_CSE2001_002",
      "courseId": "CSE2001_2024_ODD",
      "courseCode": "CSE2001",
      "title": "Quiz 2: Trees and Graphs",
      "timeLimit": 30,
      "attemptsAllowed": 2,
      "attemptsUsed": 1,
      "bestGrade": 85,
      "openDate": "2024-01-15T08:00:00Z",
      "closeDate": "2024-01-15T20:00:00Z",
      "status": "AVAILABLE",
      "questionsCount": 15
    }
  ]
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 401 | Unauthorized |
| 404 | Course/Assignment not found |
| 503 | Moodle unavailable |

---

## Assignment Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Not started |
| `IN_PROGRESS` | Started but not submitted |
| `SUBMITTED` | Submitted, awaiting grading |
| `GRADED` | Graded |
| `OVERDUE` | Past due date |
| `LATE_SUBMITTED` | Submitted after due date |

---

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)