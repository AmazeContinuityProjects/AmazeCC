import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  computeDuesTotals,
  dedupeBooks,
  formatIsbns,
  groupHoldings,
  hasPatronData,
  holdingStatusTone,
  parseLocation,
  stripCheckinPrefix,
  stripKohaSuffix,
  stripSearchPrefix,
  totalPages,
  type BookResult,
  type Holding,
} from "../lib/libraries/koha";

describe("parseLocation", () => {
  it("reads a bare integer floor, row, column and zone", () => {
    expect(parseLocation("3_R2_C4_STACKS")).toEqual({
      floor: "3",
      row: "R2",
      column: "C4",
      zone: "Stacks",
    });
  });

  it("reads roman numeral floors", () => {
    expect(parseLocation("II_R1").floor).toBe("2");
    expect(parseLocation("Central_IV").floor).toBe("4");
  });

  it("re-reads the token after a floor indicator", () => {
    expect(parseLocation("FLR 3").floor).toBe("3");
    expect(parseLocation("LEVEL-V").floor).toBe("5");
  });

  it("title-cases the zone keyword", () => {
    expect(parseLocation("1_REFERENCE").zone).toBe("Reference");
    expect(parseLocation("2_PERIODICAL").zone).toBe("Periodical");
  });

  it("falls back to em-dashes and omits a missing zone", () => {
    const parsed = parseLocation("");
    expect(parsed).toEqual({ floor: "—", row: "—", column: "—", zone: "" });
    expect(parseLocation(undefined).floor).toBe("—");
  });

  it("handles free-text demo locations without throwing", () => {
    expect(parseLocation("Central Library - Stack Area").zone).toBe("Stack");
  });

  it("keeps a plain number out of the row/column slots", () => {
    const parsed = parseLocation("4");
    expect(parsed.floor).toBe("4");
    expect(parsed.row).toBe("—");
  });
});

describe("groupHoldings", () => {
  const holdings: Holding[] = [
    { shelvingLocation: "3_R2", callNumber: "QA76", status: "Available", barcode: "B1" },
    { shelvingLocation: "3_R2", callNumber: "QA76", status: "Checked out", barcode: "B2" },
    { shelvingLocation: "3_R2", callNumber: "QA77", status: "Available", barcode: "B3" },
    { shelvingLocation: "1_REF", callNumber: "PZ", status: "Available", barcode: "B4" },
    { shelvingLocation: "", callNumber: "X1", status: "Lost", barcode: "B5" },
  ];

  it("groups by location and tallies availability", () => {
    const groups = groupHoldings(holdings);
    expect(groups).toHaveLength(3);
    const main = groups.find((g) => g.key === "3_R2")!;
    expect(main.total).toBe(3);
    expect(main.available).toBe(2);
    expect(main.parsed.floor).toBe("3");
  });

  it("dedupes call numbers inside a group", () => {
    const main = groupHoldings(holdings).find((g) => g.key === "3_R2")!;
    expect(main.callNumbers).toEqual(["QA76", "QA77"]);
  });

  it("buckets holdings with no location", () => {
    const groups = groupHoldings(holdings);
    expect(groups.some((g) => g.key === "__noloc__")).toBe(true);
  });

  it("returns nothing for an empty or missing list", () => {
    expect(groupHoldings([])).toEqual([]);
    expect(groupHoldings()).toEqual([]);
  });

  it("maps status to a tone", () => {
    expect(holdingStatusTone("Available")).toBe("emerald");
    expect(holdingStatusTone("Checked out")).toBe("amber");
    expect(holdingStatusTone("Not for loan")).toBe("red");
    expect(holdingStatusTone(undefined)).toBe("zinc");
  });
});

describe("catalog helpers", () => {
  const books: BookResult[] = [
    { title: "DSA", author: "CLRS", isbn: "978-1" },
    { title: "DSA", author: "CLRS", isbn: "978-1" },
    { title: "DSA", author: "Other", isbn: "" },
  ];

  it("collapses duplicate editions by ISBN then title+author", () => {
    const out = dedupeBooks(books);
    expect(out).toHaveLength(2);
    expect(out[0].isbn).toBe("978-1");
  });

  it("splits multi-ISBN fields", () => {
    expect(formatIsbns("111, 222;333")).toEqual(["111", "222", "333"]);
    expect(formatIsbns("")).toEqual([]);
    expect(formatIsbns(undefined)).toEqual([]);
  });

  it("paginates with a sane minimum of one page", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(20)).toBe(1);
    expect(totalPages(21)).toBe(2);
    expect(totalPages(95, 20)).toBe(5);
    expect(PAGE_SIZE).toBe(20);
  });
});

describe("patron text helpers", () => {
  it("strips the koha search prefix", () => {
    expect(stripSearchPrefix("kw,wrdl: algorithms")).toBe("algorithms");
    expect(stripSearchPrefix("Data Structures")).toBe("Data Structures");
    expect(stripSearchPrefix(undefined)).toBe("");
  });

  it("strips a check-in date prefix", () => {
    expect(stripCheckinPrefix("Check-in date: 2026-01-02")).toBe("2026-01-02");
    expect(stripCheckinPrefix("2026-01-02")).toBe("2026-01-02");
  });

  it("strips a trailing koha item id from titles", () => {
    expect(stripKohaSuffix("Data Structures (12345)")).toBe("Data Structures");
    expect(stripKohaSuffix("Pure Math")).toBe("Pure Math");
    expect(stripKohaSuffix(undefined)).toBe("");
  });
});

describe("dues totals", () => {
  it("prefers the outstanding column and counts paid rows", () => {
    const totals = computeDuesTotals({
      tables: [
        {
          headers: ["Type", "Amount", "Amount outstanding"],
          rows: [
            ["Fine", "100.00", "40.00"],
            ["Payment", "500.00", "0.00"],
          ],
        },
      ],
    });
    expect(totals.outstanding).toBe(40);
    expect(totals.paidCount).toBe(1);
    expect(totals.chargeCount).toBe(2);
  });

  it("falls back to the amount column", () => {
    const totals = computeDuesTotals({
      tables: [{ headers: ["Type", "Amount"], rows: [["Fine", "25.5"]] }],
    });
    expect(totals.outstanding).toBe(25.5);
  });

  it("is zero when there is nothing to sum", () => {
    expect(computeDuesTotals()).toEqual({ outstanding: 0, paidCount: 0, chargeCount: 0 });
    expect(computeDuesTotals({ tables: [] })).toEqual({
      outstanding: 0,
      paidCount: 0,
      chargeCount: 0,
    });
  });

  it("detects whether any patron section has content", () => {
    expect(hasPatronData(null)).toBe(false);
    expect(hasPatronData({})).toBe(false);
    expect(hasPatronData({ charges: { tables: [] } })).toBe(false);
    expect(hasPatronData({ charges: { alerts: ["Overdue"] } })).toBe(true);
    expect(hasPatronData({ history: { tables: [{ headers: [], rows: [] }] } })).toBe(true);
  });
});
