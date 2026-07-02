# Research Endpoints

## GET /api/research/faculty
Search faculty profiles.

**Query Parameters:**
- `q` (optional): Search query (name, department, research area)
- `school` (optional): Filter by school (SCOPE, SELECT, SENSE, etc.)
- `campus` (optional): Filter by campus
- `limit` (optional): Results per page (default 20)

**Response (200):**
```json
{
  "data": [
    {
      "facultyId": "FAC_001234",
      "name": "Dr. Sarah Johnson",
      "designation": "Professor",
      "school": "SCOPE",
      "department": "Computer Science and Engineering",
      "campus": "Chennai",
      "email": "sarah.johnson@vit.ac.in",
      "phone": "+91-44-XXXXXXXX",
      "office": "TT Block, Room 305",
      "researchAreas": [
        "Machine Learning",
        "Computer Vision",
        "Deep Learning"
      ],
      "publicationsCount": 87,
      "citations": 3421,
      "hIndex": 32,
      "profileUrl": "https://faculty.vit.ac.in/sarah.johnson",
      "googleScholar": "https://scholar.google.com/citations?user=...",
      "orcid": "0000-0000-0000-0000",
      "currentProjects": 3,
      "phdScholars": 8
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

---

## GET /api/research/profile
Get detailed faculty profile (requires facultyId).

**Query Parameters:**
- `facultyId` (required): Faculty ID

**Response (200):**
```json
{
  "data": {
    "facultyId": "FAC_001234",
    "name": "Dr. Sarah Johnson",
    "designation": "Professor",
    "school": "SCOPE",
    "department": "Computer Science and Engineering",
    "campus": "Chennai",
    "contact": {
      "email": "sarah.johnson@vit.ac.in",
      "phone": "+91-44-XXXXXXXX",
      "office": "TT Block, Room 305"
    },
    "education": [
      {
        "degree": "Ph.D. Computer Science",
        "institute": "IIT Madras",
        "year": 2008
      },
      {
        "degree": "M.Tech Computer Science",
        "institute": "IIT Bombay",
        "year": 2003
      }
    ],
    "researchAreas": [
      "Machine Learning",
      "Computer Vision",
      "Deep Learning",
      "Natural Language Processing"
    ],
    "publications": [
      {
        "title": "Deep Learning for Medical Image Analysis",
        "journal": "IEEE Transactions on Medical Imaging",
        "year": 2023,
        "citations": 145,
        "doi": "10.1109/TMI.2023.1234567",
        "url": "https://ieeexplore.ieee.org/document/..."
      }
    ],
    "projects": [
      {
        "title": "AI-Powered Healthcare Diagnostics",
        "fundingAgency": "DST",
        "amount": "₹2.5 Cr",
        "duration": "2022-2025",
        "role": "Principal Investigator",
        "status": "ONGOING"
      }
    ],
    "phdScholars": [
      { "name": "Amit Kumar", "topic": "Few-shot Learning", "status": "PURSUING" },
      { "name": "Priya Sharma", "topic": "Medical AI", "status": "AWARDED", "year": 2023 }
    ],
    "awards": [
      "Best Paper Award, ICML 2022",
      "Young Scientist Award, DST 2019"
    ],
    "metrics": {
      "totalPublications": 87,
      "totalCitations": 3421,
      "hIndex": 32,
      "i10Index": 58
    }
  }
}
```

---

## GET /api/research/project
Get research project details.

**Query Parameters:**
- `projectId` (optional): Specific project
- `facultyId` (optional): Projects by faculty
- `status` (optional): `ONGOING`, `COMPLETED`, `APPROVED`
- `fundingAgency` (optional): Filter by agency

**Response (200):**
```json
{
  "data": [
    {
      "projectId": "PRJ_2022_001",
      "title": "AI-Powered Healthcare Diagnostics",
      "principalInvestigator": "Dr. Sarah Johnson (FAC_001234)",
      "coInvestigators": ["Dr. Amit Patel (FAC_002345)"],
      "fundingAgency": "Department of Science & Technology (DST)",
      "sanctionedAmount": "₹2,50,00,000",
      "duration": "36 months",
      "startDate": "2022-04-01",
      "endDate": "2025-03-31",
      "status": "ONGOING",
      "domain": "Artificial Intelligence in Healthcare",
      "description": "Developing deep learning models for early disease detection...",
      "objectives": [
        "Build CNN models for X-ray analysis",
        "Develop federated learning framework",
        "Clinical validation at partner hospitals"
      ],
      "outcomes": [
        "3 patents filed",
        "5 journal publications",
        "2 conference papers"
      ],
      "studentInvolvement": {
        "phd": 3,
        "masters": 5,
        "bachelors": 8
      }
    }
  ]
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Missing facultyId/projectId |
| 401 | Unauthorized |
| 404 | Not found |
| 503 | Research portal unavailable |

---

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)