/**
 * Demo-mode fixtures for the Libraries feature.
 *
 * The page and the command palette each used to carry their own private copies
 * of these payloads (three in total, drifting apart). One definition, used by
 * every host, so demo mode shows the same catalogue everywhere.
 */

import type {
  BookDetail,
  BookResult,
  LibraryDueResponse,
  PatronPages,
} from "./koha";

export const DEMO_BOOKS: BookResult[] = [
  {
    biblionumber: "10920",
    title: "Clean Code: A Handbook of Agile Software Craftsmanship",
    author: "Robert C. Martin",
    publisher: "Prentice Hall",
    isbn: "978-0132350884",
    itemtype: "Book",
    copies: "5",
    available: "3",
  },
  {
    biblionumber: "20194",
    title: "Design Patterns: Elements of Reusable Object-Oriented Software",
    author: "Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides",
    publisher: "Addison-Wesley",
    isbn: "978-0201633610",
    itemtype: "Book",
    copies: "8",
    available: "6",
  },
  {
    biblionumber: "30112",
    title: "Introduction to Algorithms",
    author: "Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein",
    publisher: "MIT Press",
    isbn: "978-0262046305",
    itemtype: "Book",
    copies: "4",
    available: "0",
  },
];

export const DEMO_DETAILS: Record<string, BookDetail> = {
  "10920": {
    ...DEMO_BOOKS[0],
    edition: "1st",
    ddc: "005.1",
    summary:
      "Even bad code can function. But if code isn't clean, it can bring a development organization to its knees.",
    description: "Hardcover, 464 pages",
    subjects: ["Software engineering", "Agile development", "Code quality"],
    holdings: [
      {
        itemId: "i1",
        barcode: "BC-90184",
        shelvingLocation: "3_R2_C4_STACKS",
        callNumber: "005.1 MAR",
        status: "Available",
        currentLibrary: "Central Library",
        homeLibrary: "Central Library",
      },
      {
        itemId: "i2",
        barcode: "BC-90185",
        shelvingLocation: "3_R2_C4_STACKS",
        callNumber: "005.1 MAR",
        status: "Checked out",
        dateDue: "2026-07-10",
        currentLibrary: "Central Library",
        homeLibrary: "Central Library",
      },
      {
        itemId: "i3",
        barcode: "BC-90186",
        shelvingLocation: "2_REFERENCE",
        callNumber: "005.1 MAR",
        status: "Not for loan",
        currentLibrary: "Central Library",
        homeLibrary: "Central Library",
      },
    ],
  },
  "20194": {
    ...DEMO_BOOKS[1],
    edition: "2nd",
    ddc: "005.1",
    summary:
      "Captures a body of knowledge about design patterns, describing what they are, what they do, and why they are useful.",
    description: "Hardcover, 395 pages",
    subjects: ["Design patterns", "Object-oriented programming"],
    holdings: [
      {
        itemId: "i4",
        barcode: "BC-77410",
        shelvingLocation: "FLR 3_R1",
        callNumber: "005.138 GAM",
        status: "Available",
        currentLibrary: "Central Library",
        homeLibrary: "Central Library",
      },
    ],
  },
  "30112": {
    ...DEMO_BOOKS[2],
    edition: "4th",
    ddc: "005.1",
    summary:
      "A comprehensive introduction to the modern study of computer algorithms.",
    description: "Hardcover, 1312 pages",
    subjects: ["Algorithms", "Computer programming"],
    holdings: [
      {
        itemId: "i5",
        barcode: "BC-60011",
        shelvingLocation: "1_R4",
        callNumber: "005.1 COR",
        status: "Checked out",
        dateDue: "2026-06-28",
        currentLibrary: "Central Library",
        homeLibrary: "Central Library",
      },
    ],
  },
};

export const DEMO_PATRON_PAGES: PatronPages = {
  charges: {
    title: "Account Charges",
    tables: [
      {
        headers: ["Type", "Description", "Amount", "Amount outstanding", "Created", "Updated"],
        rows: [
          ["Fine", "Overdue Fine: Introduction to Algorithms", "120.00", "120.00", "2026-06-15", "2026-06-20"],
          ["Payment", "Fine payment — receipt FEE-2026-10492", "500.00", "0.00", "2026-06-02", "2026-06-02"],
        ],
      },
    ],
  },
  checkouts: {
    title: "Current Checkouts",
    tables: [
      {
        headers: ["Title", "Author", "Due", "Call number", "Item type"],
        rows: [
          ["Introduction to Algorithms (30112)", "Cormen", "Check-in date: 2026-06-01", "005.1 COR", "Book"],
        ],
      },
    ],
  },
  history: {
    title: "Search History",
    tables: [
      {
        headers: ["Search", "Date", "Results"],
        rows: [
          ["kw,wrdl: data structures", "2026-06-18", "34"],
          ["kw,wrdl: operating systems", "2026-05-02", "112"],
          ["ti:clean code", "2026-04-11", "1"],
        ],
      },
    ],
  },
};

export const DEMO_PATRON_INFO = {
  name: "Demo Student",
  cardnumber: "22BCE1234",
  category: "Undergraduate",
  library: "Central Library",
};

export const DEMO_DUES: LibraryDueResponse = {
  success: true,
  books: [
    { title: "Introduction to Algorithms", author: "Cormen", isbn: "978-0262046305", dueAmount: "120.00", daysOverdue: 12 },
    { title: "Discrete Mathematics and Its Applications", author: "Rosen", isbn: "978-0030596069", dueAmount: "60.00", daysOverdue: 4 },
  ],
  messages: { warning: "2 books are past their due date." },
};
