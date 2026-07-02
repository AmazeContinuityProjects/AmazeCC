# Payment Endpoints

## GET /api/payments
Get fee dues and payment history.

**Response (200):**
```json
{
  "data": {
    "dues": [
      {
        "id": "FEE_2024_ODD_001",
        "category": "TUITION_FEE",
        "description": "Tuition Fee - 2024-25 Odd Semester",
        "amount": 145000,
        "paidAmount": 0,
        "balance": 145000,
        "dueDate": "2024-07-31",
        "status": "PENDING",
        "installments": [
          { "number": 1, "amount": 72500, "dueDate": "2024-07-15", "status": "PENDING" },
          { "number": 2, "amount": 72500, "dueDate": "2024-08-31", "status": "PENDING" }
        ]
      },
      {
        "id": "FEE_2024_ODD_002",
        "category": "HOSTEL_FEE",
        "description": "Hostel & Mess Fee",
        "amount": 85000,
        "paidAmount": 85000,
        "balance": 0,
        "dueDate": "2024-06-30",
        "status": "PAID"
      }
    ],
    "summary": {
      "totalDues": 145000,
      "totalPaid": 85000,
      "totalBalance": 145000,
      "overdueAmount": 0
    }
  }
}
```

---

## GET /api/payments/receipts
Get payment receipts.

**Query Parameters:**
- `limit` (default 20)
- `offset` (default 0)
- `startDate`, `endDate` (filter range)

**Response (200):**
```json
{
  "data": [
    {
      "receiptId": "RCT_20240115_001",
      "transactionId": "TXN_20240115_ABC123",
      "date": "2024-01-15T10:30:00Z",
      "amount": 85000,
      "category": "HOSTEL_FEE",
      "method": "ONLINE_UPI",
      "status": "SUCCESS",
      "pdfUrl": "https://api.amazecc.com/receipts/RCT_20240115_001.pdf"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

---

## GET /api/payments/wallet
Get wallet balance and transactions.

**Response (200):**
```json
{
  "data": {
    "balance": 2500.00,
    "currency": "INR",
    "transactions": [
      {
        "id": "WLT_001",
        "type": "CREDIT",
        "amount": 5000,
        "description": "Refund - Excess Mess Fee",
        "date": "2024-01-10T14:20:00Z",
        "balanceAfter": 7500
      },
      {
        "id": "WLT_002",
        "type": "DEBIT",
        "amount": 5000,
        "description": "Fee Payment - Tuition",
        "date": "2024-01-15T10:30:00Z",
        "balanceAfter": 2500
      }
    ]
  }
}
```

---

## POST /api/payments/online-transfer
Initiate online fee payment.

**Request:**
```json
{
  "feeIds": ["FEE_2024_ODD_001"],
  "paymentMethod": "UPI",
  "upiId": "user@bank",
  "amount": 145000
}
```

**Payment Methods:**
- `UPI` - UPI ID
- `NET_BANKING` - Net banking
- `CARD` - Credit/Debit card
- `WALLET` - Campus wallet

**Response (200):**
```json
{
  "data": {
    "paymentId": "PAY_20240115_001",
    "orderId": "ORD_20240115_ABC123",
    "paymentUrl": "https://payments.vit.ac.in/pay/ORD_20240115_ABC123",
    "expiresAt": "2024-01-15T11:00:00Z",
    "amount": 145000
  }
}
```

**Response (400):**
```json
{
  "error": "INVALID_AMOUNT",
  "message": "Amount does not match fee dues"
}
```

---

## GET /api/payments/status/:paymentId
Check payment status.

**Response (200):**
```json
{
  "data": {
    "paymentId": "PAY_20240115_001",
    "status": "SUCCESS",
    "transactionId": "TXN_20240115_ABC123",
    "paidAt": "2024-01-15T10:35:00Z",
    "receiptId": "RCT_20240115_001"
  }
}
```

**Payment Statuses:**
- `INITIATED` - Payment started
- `PENDING` - Awaiting confirmation
- `SUCCESS` - Payment completed
- `FAILED` - Payment failed
- `CANCELLED` - User cancelled
- `REFUNDED` - Refund processed

---

## Fee Categories

| Category | Description |
|----------|-------------|
| `TUITION_FEE` | Academic tuition |
| `HOSTEL_FEE` | Hostel accommodation |
| `MESS_FEE` | Mess/dining charges |
| `EXAM_FEE` | Examination fees |
| `LIBRARY_FEE` | Library charges |
| `TRANSPORT_FEE` | Bus/transport |
| `OTHER` | Miscellaneous |

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid fee IDs, amount mismatch |
| 401 | Unauthorized |
| 402 | Payment required (insufficient wallet) |
| 404 | Fee/Receipt not found |
| 409 | Duplicate payment |
| 503 | Payment gateway unavailable |

---

## Related Documentation

- [API Overview](../overview.md)
- [Authentication](./auth.md)