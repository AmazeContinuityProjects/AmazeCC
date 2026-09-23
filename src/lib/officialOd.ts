import { storage } from "./storage";
import type { OfficialOdRecord, OfficialOdResponse } from "@/types/data/od";

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "15-Dec-2025" -> midnight timestamp (NaN if unparseable) */
export function parseVtopDay(dateStr: string): number {
  const m = String(dateStr || "").trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return NaN;
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return NaN;
  return new Date(Number(m[3]), month, Number(m[1])).getTime();
}

/** "03-Aug-2026 to 03-Aug-2026" (or a single day) -> [from, to] timestamps */
export function parseOdDateRange(range: string): [number, number] {
  const parts = String(range || "").split(/\s+to\s+/i).map((s) => s.trim());
  const from = parseVtopDay(parts[0] || "");
  const to = parseVtopDay(parts[1] || parts[0] || "");
  return [from, to];
}

/** Official OD records whose date range contains the given attendance day. */
export function matchOfficialOdForDate(
  dayDate: string,
  records: OfficialOdRecord[] | undefined | null,
): OfficialOdRecord[] {
  if (!records || records.length === 0) return [];
  const t = parseVtopDay(dayDate);
  if (isNaN(t)) return [];
  return records.filter((r) => {
    const [from, to] = parseOdDateRange(r.date);
    return !isNaN(from) && !isNaN(to) && t >= from && t <= to;
  });
}

export function getCurrentSemesterId(): string {
  try {
    const raw = localStorage.getItem("settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.currSemesterID) return String(parsed.currSemesterID);
    }
  } catch {}
  return "";
}

/** Read synced official OD for a semester (defaults to current). */
export function getOfficialOd(semesterId?: string): OfficialOdResponse | null {
  const sem = semesterId || getCurrentSemesterId();
  if (!sem || typeof window === "undefined") return null;
  try {
    return storage.officialOd.get(sem);
  } catch {
    return null;
  }
}

/** Why did this attendance day get OD? Reads official OD from local storage. */
export function findOfficialOdWhy(dayDate: string, semesterId?: string): OfficialOdRecord[] {
  return matchOfficialOdForDate(dayDate, getOfficialOd(semesterId)?.records);
}

export function formatSemesterName(semId: string): string {
  if (!semId || !semId.toUpperCase().startsWith("CH")) return semId;
  const year1 = semId.substring(2, 6);
  const year2 = semId.substring(6, 8);
  const term = semId.substring(8, 10);
  let termName = "";
  if (term === "01") termName = "Fall";
  else if (term === "05") termName = "Winter";
  else if (term === "07") termName = "Summer";
  else termName = `Term ${term}`;
  return `${termName} ${year1}-${year2}`;
}

export const DEMO_OFFICIAL_OD: OfficialOdResponse = {
  success: true,
  semesterId: "DEMO",
  totalCount: 2,
  note: "OD Count (excluding Sectional Holidays and Placement Activities) is calculated irrespective of faculty attendance posting.",
  records: [
    {
      slNo: "1",
      type: "On Duty",
      reason: "Technical Competitions",
      basis: "Hours in a Day",
      date: "15-Dec-2025 to 15-Dec-2025",
      time: "08:00 Hrs to 08:55 Hrs",
      remarks: "V-Medithon 3.0",
    },
    {
      slNo: "2",
      type: "On Duty",
      reason: "Other Cultural Fests",
      basis: "Hours in a Day",
      date: "08-Dec-2025 to 08-Dec-2025",
      time: "08:00 Hrs to 19:30 Hrs",
      remarks: "CyberConverge Event",
    },
  ],
};
