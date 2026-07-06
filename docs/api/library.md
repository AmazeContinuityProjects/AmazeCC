# Library Endpoints

## GET /api/library/koha/search
Search library catalog (KOHA).

**Query Parameters:**
- `q` (required): Search query
- `type` (optional): `keyword`, `title`, `author`, `subject`, `isbn`, `series` (default: `keyword`)
- `limit` (optional): Results per page (default 20)
- `page` (optional): Page number

**Response (200):**
```json
{
  "data": [
    {
      "biblionumber": 12345,
      "title": "Introduction to Algorithms",
      "author": "Thomas H. Cormen",
      "isbn": "9780262033848",
      "year": 2009,
      "publisher": "MIT Press",
      "subject": ["Algorithms", "Computer Science"],
      "items": [
        {
          "itemnumber": 67890,
          "barcode": "VIT001234",
          "homebranch": "Main Library",
          "location": "Stacks",
          "callnumber": "QA76.6.C662 2009",
          "status": "Available",
          "dueDate": null
        },
        {
          "itemnumber": 67891,
          "barcode": "VIT001235",
          "homebranch": "Main Library",
          "location": "Reference",
          "callnumber": "QA76.6.C662 2009",
          "status": "On Loan",
          "dueDate": "2024-02-15"
        }
      ],
      "availability": "Available (1 of 2 copies)"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

## POST /api/library/koha/login
Login to KOHA for patron actions.

**Request:**
```json
{
  "username": "21BCE1234",
  "password": "library_password"
}
```

**Response (200):**
```json
{
  "data": {
    "patronId": 12345,
    "token": "koha_session_token",
    "expiresAt": "2024-01-16T10:30:00Z"
  }
}
```

---

## GET /api/library/koha/patron
Get patron account details (requires KOHA login).

**Headers:**
```
Authorization: Bearer <koha_token>
```

**Response (200):**
```json
{
  "data": {
    "patronId": 12345,
    "name": "JOHN DOE",
    "email": "john.doe2021@vitstudent.ac.in",
    "cardNumber": "21BCE1234",
    "checkouts": [
      {
        "issueId": 789,
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "barcode": "VIT002345",
        "issuedDate": "2024-01-01",
        "dueDate": "2024-01-15",
        "renewalsLeft": 2,
        "canRenew": true
      }
    ],
    "holds": [
      {
        "reserveId": 456,
        "title": "Design Patterns",
        "author": "Gang of Four",
        "queuePosition": 3,
        "waitingSince": "2024-01-10"
      }
    ],
    "fines": {
      "total": 0,
      "items": []
    },
    "messages": []
  }
}
```

---

## POST /api/library/koha/renew
Renew a checked-out item.

**Headers:**
```
Authorization: Bearer <koha_token>
```

**Request:**
```json
{
  "issueId": 789
}
```

**Response (200):**
```json
{
  "data": {
    "issueId": 789,
    "newDueDate": "2024-01-29",
    "renewalsUsed": 1,
    "renewalsLeft": 1
  }
}
```

---

## GET /api/library/due
Get library dues/fines (from VTOP).

**Response (200):**
```json
{
  "data": {
    "totalDue": 150,
    "currency": "INR",
    "items": [
      {
        "type": "OVERDUE_FINE",
        "description": "Clean Code - 5 days overdue",
        "amount": 100,
        "dueDate": "2024-01-20"
      },
      {
        "type": "LOST_BOOK",
        "description": "Design Patterns - Reported lost",
        "amount": 500,
        "dueDate": "2024-01-25"
      }
    ],
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid query / Missing KOHA token |
| 401 | Unauthorized / KOHA login required |
| 404 | Book/Patron not found |
| 503 | KOHA/VTOP unavailable |

---

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)