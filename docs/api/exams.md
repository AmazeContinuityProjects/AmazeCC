# Exams Endpoints

## GET /api/exams/arrear
Get arrear exam details.

**Response (200):**
```json
{
  "data": [
    {
      "subjectCode": "MAT1001",
      "subjectName": "Calculus and Linear Algebra",
      "semester": "2022-23 Even",
      "grade": "F",
      "arrearType": "REGULAR",
      "examDate": "2024-05-15",
      "examTime": "09:30-12:30",
      "venue": "MB301",
      "hallTicketUrl": "https://vtop.vit.ac.in/hallticket/...",
      "status": "REGISTERED"
    }
  ]
}
```

---

## GET /api/exams/makeup
Get makeup exam details.

**Response (200):**
```json
{
  "data": [
    {
      "subjectCode": "CSE2001",
      "subjectName": "Data Structures and Algorithms",
      "originalExam": "FAT",
      "makeupDate": "2024-05-20",
      "makeupTime": "14:00-17:00",
      "venue": "TT204",
      "reason": "Medical leave",
      "status": "APPROVED",
      "applicationId": "MKP_2024_001"
    }
  ]
}
```

---

## GET /api/exams/compre
Get comprehensive exam details (final year).

**Response (200):**
```json
{
  "data": {
    "isEligible": true,
    "exams": [
      {
        "subjectCode": "CSE4099",
        "subjectName": "Comprehensive Viva",
        "date": "2024-04-25",
        "time": "10:00-13:00",
        "venue": "TT Block Conference Room",
        "panel": ["Dr. A", "Dr. B", "Dr. C"]
      }
    ],
    "projectReview": {
      "date": "2024-04-20",
      "time": "09:00-17:00",
      "venue": "Project Lab"
    }
  }
}
```

---

## GET /api/exams/reexam
Get re-exam (supplementary) details.

**Response (200):**
```json
{
  "data": [
    {
      "subjectCode": "PHY1001",
      "subjectName": "Engineering Physics",
      "examDate": "2024-06-10",
      "examTime": "09:30-12:30",
      "fee": 500,
      "paymentStatus": "PAID",
      "paymentRef": "PAY_20240115_001",
      "applicationStatus": "SUBMITTED",
      "deadline": "2024-05-31"
    }
  ]
}
```

---

## POST /api/exams/makeup/apply
Apply for makeup exam.

**Request:**
```json
{
  "subjectCode": "CSE2001",
  "examType": "FAT",
  "reason": "MEDICAL",
  "supportingDocument": "base64_encoded_pdf",
  "parentContact": "9876500000"
}
```

**Response (200):**
```json
{
  "data": {
    "applicationId": "MKP_2024_001",
    "status": "SUBMITTED",
    "submittedAt": "2024-01-15T10:30:00Z",
    "estimatedDecision": "2024-01-17T18:00:00Z"
  }
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid subject / Missing documents |
| 401 | Unauthorized |
| 404 | No exams found |
| 409 | Already applied |
| 422 | Invalid reason / Past deadline |
| 503 | VTOP unavailable |

---

## Makeup Exam Reasons

| Reason Code | Description | Documents Required |
|-------------|-------------|-------------------|
| `MEDICAL` | Medical emergency | Medical certificate |
| `OD` | On-duty (academic event) | OD approval letter |
| `SPORTS` | Sports representation | Selection letter |
| `CULTURAL` | Cultural event | Participation proof |
| `PERSONAL` | Family emergency | Supporting documents |

---

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)