# QBank — Data Model

`QBankCourse = { code, title, branch, counts }`
`QBankPaper = { id, course, type, year, examDate, pdfUrl? }`
`QBankQuestion = { id, paperId, type: "mcq"|"subjective", body, latex, options[]? }`.
