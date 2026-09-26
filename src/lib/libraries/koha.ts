/**
 * Pure helpers for the Libraries feature (OPAC catalog + Koha patron account).
 *
 * Kept out of the components on purpose: the shelving-location parser and the
 * holdings grouping are the fiddly parts, and the previous split between the
 * page and the command-palette copy of this UI is exactly what let them drift.
 */

export const PAGE_SIZE = 20;

// ── types ────────────────────────────────────────────────────────────
export type SearchIndex = "kw" | "ti" | "au" | "su" | "nb";

export const SEARCH_LABELS: Record<SearchIndex, string> = {
  kw: "Keyword",
  ti: "Title",
  au: "Author",
  su: "Subject",
  nb: "ISBN",
};

export interface BookResult {
  biblionumber?: number | string;
  title: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  coverUrl?: string;
  copies?: number | string;
  available?: number | string;
  itemtype?: string;
}

export interface Holding {
  itemId?: string;
  barcode?: string;
  shelvingLocation?: string;
  callNumber?: string;
  status?: string;
  currentLibrary?: string;
  homeLibrary?: string;
  dateDue?: string;
}

export interface BookDetail extends BookResult {
  edition?: string;
  description?: string;
  summary?: string;
  ddc?: string;
  subjects?: string[];
  holdings?: Holding[];
}

export interface PatronTable {
  caption?: string;
  headers?: string[];
  rows?: (string | number)[][];
}

export interface PatronPage {
  title?: string;
  tables?: PatronTable[];
  alerts?: string[];
}

export interface PatronPages {
  charges?: PatronPage;
  checkouts?: PatronPage;
  history?: PatronPage;
  [key: string]: PatronPage | undefined;
}

export interface DueBook {
  title?: string;
  author?: string;
  isbn?: string;
  dueAmount?: string | number;
  daysOverdue?: number | string;
}

export interface LibraryDueResponse {
  success?: boolean;
  tables?: PatronTable[];
  keyValuePairs?: Record<string, string | number>;
  books?: DueBook[];
  messages?: { warning?: string; error?: string; success?: string };
  error?: string;
}

export const num = (v: unknown, fallback = 0): number => {
  if (v === undefined || v === null || v === "") return fallback;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? fallback : n;
};

// ── shelving location parsing ─────────────────────────────────────────
const ROMAN_MAP: Record<string, string> = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
  V: "5",
  VI: "6",
};
const FLOOR_INDICATORS = new Set(["FLOOR", "FLR", "F", "LEVEL", "LVL", "L"]);
const ZONE_KEYWORDS = new Set([
  "STACK",
  "STACKS",
  "REF",
  "REFERENCE",
  "RESERVE",
  "OVERSIZE",
  "PERIODICAL",
  "THESIS",
  "CD",
  "DVD",
  "MEDIA",
]);

export interface ParsedLocation {
  floor: string;
  row: string;
  column: string;
  zone: string;
}

/** "FLR 3_R2_C4_STACKS" -> { floor: "3", row: "R2", column: "C4", zone: "Stacks" } */
export function parseLocation(loc?: string): ParsedLocation {
  const parts = (loc || "").split(/[_/\s-]+/).filter(Boolean);
  let floor = "";
  let row = "";
  let column = "";
  let zone = "";
  let floorIdx = -1;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const upper = p.toUpperCase();

    if (/^R\d+$/i.test(p)) {
      row = upper;
      continue;
    }
    if (/^C\d+$/i.test(p)) {
      column = upper;
      continue;
    }
    if (ZONE_KEYWORDS.has(upper)) {
      zone = upper.charAt(0) + upper.slice(1).toLowerCase();
      continue;
    }
    if (FLOOR_INDICATORS.has(upper)) {
      floorIdx = i;
      continue;
    }

    if (!floor) {
      if (/^\d+$/.test(p)) {
        floor = p;
        continue;
      }
      const roman = ROMAN_MAP[upper];
      if (roman) {
        floor = roman;
        continue;
      }
      if (FLOOR_INDICATORS.has(upper)) floorIdx = i;
    }
  }

  // "FLR 3" — the floor indicator came first, so re-read the token after it
  const nextAfterFloor =
    floorIdx >= 0 && floorIdx + 1 < parts.length ? parts[floorIdx + 1].toUpperCase() : "";
  if (!floor && nextAfterFloor) {
    if (/^\d+$/.test(nextAfterFloor)) floor = nextAfterFloor;
    else floor = ROMAN_MAP[nextAfterFloor] || "";
  }

  return { floor: floor || "—", row: row || "—", column: column || "—", zone: zone || "" };
}

export interface HoldingsGroup {
  key: string;
  parsed: ParsedLocation;
  holdings: Holding[];
  callNumbers: string[];
  available: number;
  total: number;
}

/** Group every copy by shelving location and tally availability. */
export function groupHoldings(holdings: Holding[] = []): HoldingsGroup[] {
  const groups = new Map<string, HoldingsGroup>();

  for (const h of holdings) {
    const key = h.shelvingLocation || "__noloc__";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        parsed: parseLocation(key),
        holdings: [],
        callNumbers: [],
        available: 0,
        total: 0,
      });
    }
    const g = groups.get(key)!;
    g.holdings.push(h);
    g.total += 1;
    if (h.callNumber && !g.callNumbers.includes(h.callNumber)) {
      g.callNumbers.push(h.callNumber);
    }
    if (h.status === "Available") g.available += 1;
  }

  return Array.from(groups.values());
}

export function holdingStatusTone(status?: string): "emerald" | "amber" | "red" | "zinc" {
  const s = (status || "").toLowerCase();
  if (s === "available") return "emerald";
  if (s.includes("checked out")) return "amber";
  if (s.includes("not for loan") || s.includes("lost") || s.includes("missing")) return "red";
  return "zinc";
}

// ── catalog results ──────────────────────────────────────────────────
/** Collapse duplicate editions: prefer ISBN, else title+author. */
export function dedupeBooks(books: BookResult[] = []): BookResult[] {
  const seen = new Set<string>();
  const out: BookResult[] = [];
  for (const b of books) {
    const key =
      b.isbn ||
      `${(b.title || "").toLowerCase().trim()}|${(b.author || "").toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

/** OPAC sometimes returns several ISBNs in one field. */
export function formatIsbns(isbn?: string): string[] {
  if (!isbn) return [];
  return isbn
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function totalPages(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil((total || 0) / pageSize));
}

// ── patron page text munging ─────────────────────────────────────────
/** "kw,wrdl: algorithms" -> "algorithms" */
export function stripSearchPrefix(value?: string): string {
  if (!value) return "";
  return value.replace(/kw\s*,\s*wrdl\s*:\s*/i, "").replace(/^[\s,:-]+/, "").trim();
}

/** "Check-in date: 2026-01-02" -> "2026-01-02" */
export function stripCheckinPrefix(value?: string): string {
  if (!value) return "";
  return value.replace(/^\s*check-?in\s*date\s*:?\s*/i, "").trim();
}

/** Koha appends the item id to titles: "Data Structures (12345)" -> "Data Structures" */
export function stripKohaSuffix(title?: string): string {
  if (!title) return "";
  return title.replace(/\s*\(\d+\)\s*$/, "").trim();
}

export interface DuesTotals {
  outstanding: number;
  paidCount: number;
  chargeCount: number;
}

/** Sum the "Amount outstanding" column, falling back to "Amount". */
export function computeDuesTotals(page?: PatronPage): DuesTotals {
  const totals: DuesTotals = { outstanding: 0, paidCount: 0, chargeCount: 0 };
  for (const table of page?.tables || []) {
    const headers = (table.headers || []).map((h) => String(h).toLowerCase());
    const outIdx = headers.findIndex((h) => h.includes("amount outstanding"));
    const amtIdx = headers.findIndex((h) => h === "amount" || h.includes("amount"));
    const useIdx = outIdx >= 0 ? outIdx : amtIdx;
    if (useIdx < 0) continue;

    for (const row of table.rows || []) {
      const value = row[useIdx];
      if (value === undefined || value === null || value === "") continue;
      totals.chargeCount += 1;
      const n = num(value);
      totals.outstanding += n;
      if (n === 0) totals.paidCount += 1;
    }
  }
  return totals;
}

export function hasPatronData(pages?: PatronPages | null): boolean {
  if (!pages) return false;
  return Object.values(pages).some(
    (p) => (p?.tables?.length || 0) > 0 || (p?.alerts?.length || 0) > 0
  );
}
