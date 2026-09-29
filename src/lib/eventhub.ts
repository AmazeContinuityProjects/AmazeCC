export const EVENTHUB_BASE = "https://eventhubcc.vit.ac.in";

/** Build the public poster image URL for an EventHub event from its EventHub ID. */
export function eventhubImageUrl(eid: string): string {
  if (!eid) return "";
  return `${EVENTHUB_BASE}/EventHub/image/?id=${encodeURIComponent(eid)}`;
}

/* ── Event metrics ────────────────────────────────────────────────────────
 *
 * The Event Hub list is a loose table: `date` is whatever Event Hub happened to
 * render that month ("15-Jul-2026", "2026-07-15", sometimes a slot time
 * welded onto the end), `price` is blank for free events, and a registration
 * carries its payment state as free text. The hero tiles above the list count
 * all three, so the classification lives here as plain functions rather than as
 * conditionals inside the page.
 *
 * Everything here is defensive by design: a date we cannot read must *omit* the
 * stat that needed it, never show a confident `0`. "No events this week" and
 * "we don't know when any of them are" are different claims, and only the first
 * one is true.
 */

/** The fields the metric helpers read. Every one is optional — Event Hub is not consistent. */
export interface EventLike {
  eid?: string;
  title?: string;
  type?: string;
  date?: string;
  price?: string;
  registeredDetails?: any;
  isPastEvent?: boolean;
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Local midnight for a Y/M/D triple, or null if it is not a real calendar date. */
function localMidnight(year: unknown, month: unknown, day: unknown): number | null {
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  if (!y || !mo || !d) return null;
  const date = new Date(y, mo - 1, d);
  // Rejects overflow like "31-02-2026", which the Date constructor would
  // silently roll forward into March.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date.getTime();
}

/**
 * Midnight-local timestamp for an Event Hub date string, or null.
 *
 * Handles the three shapes Event Hub actually sends: date-only ISO, day-first
 * with a numeric or three-letter month, and a full ISO timestamp.
 */
export function parseEventDate(value?: string | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // Date-only ISO is read part by part on purpose: `new Date("2026-07-15")`
  // is UTC midnight, which is the 14th anywhere west of Greenwich, and an
  // event that lands on the wrong day is worse than one with no date at all.
  const isoDate = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (isoDate) return localMidnight(isoDate[1], isoDate[2], isoDate[3]);

  // Day-first, numeric or textual month: "15-Jul-2026", "15/07/2026".
  const parts = raw.split(/[-/]/).map((p) => p.trim());
  if (parts.length === 3 && /^\d{4}$/.test(parts[2]) && /^\d{1,2}$/.test(parts[0])) {
    const month = /^\d+$/.test(parts[1])
      ? Number(parts[1]) - 1
      : MONTH_INDEX[parts[1].slice(0, 3).toLowerCase()];
    if (month !== undefined) return localMidnight(parts[2], month + 1, parts[0]);
  }

  // Anything else (a real ISO timestamp, or prose) goes to the Date
  // constructor, which is reliable about the instant even when it is only
  // approximately right about the calendar day.
  const ms = new Date(raw).getTime();
  if (isNaN(ms)) return null;
  const d = new Date(ms);
  return localMidnight(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** "Sat, 15 Jul" for a card, falling back to the raw string when the date is unreadable. */
export function eventDateLabel(value?: string | null): string {
  const raw = String(value ?? "").trim();
  const ts = parseEventDate(raw);
  if (ts === null) return raw || "Date TBA";
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Whole days from today to an event's date (negative = past), or null if unreadable. */
export function daysUntil(value?: string | null, now: Date = new Date()): number | null {
  const ts = parseEventDate(value);
  if (ts === null) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((ts - today) / 86400000);
}

/**
 * Whether an event can be entered without paying.
 *
 * A blank price means free, which is how Event Hub encodes it — the detail page
 * has always read `price || "Free"`, and an unknown fee is not an unknown
 * answer here.
 */
export function isFreeEvent(event?: { price?: string | null } | null): boolean {
  const price = String(event?.price ?? "").trim().toLowerCase();
  if (!price) return true;
  return price.includes("free") || price.includes("no cost") || price === "nil";
}

/**
 * Whether a registration's payment has settled.
 *
 * "Success" counts as paid: Event Hub uses it alongside "Paid (Online)" for
 * gateway completions, and a card showing an amber "Pending" pill over a
 * registration the Pay Now button considers settled is a bug.
 */
export function isRegistrationPaid(details?: any): boolean {
  const status = String(details?.paymentStatus ?? "").trim().toLowerCase();
  if (!status) return false;
  return status.includes("paid") || status.includes("free") || status.includes("success");
}

export interface EventSummary {
  total: number;
  free: number;
  categories: number;
  /** Registrations with an unsettled payment. */
  unpaid: number;
  /** Upcoming events within 7 days — null when no event has a readable date. */
  thisWeek: number | null;
  /** The soonest dated event, with its day offset. Null when none is dated. */
  next: { event: EventLike; days: number } | null;
}

/** Counts for the Event Hub hero tiles. */
export function summariseEvents(
  events: readonly EventLike[] | null | undefined,
  registeredEvents: readonly any[] | null | undefined = [],
  now: Date = new Date()
): EventSummary {
  const list = Array.isArray(events) ? events.filter(Boolean) : [];
  const registered = Array.isArray(registeredEvents) ? registeredEvents : [];

  const dated = list
    .map((event) => ({ event, days: daysUntil(event?.date, now) }))
    .filter((x): x is { event: EventLike; days: number } => x.days !== null && !x.event.isPastEvent);

  const upcoming = dated.filter((x) => x.days >= 0).sort((a, b) => a.days - b.days);

  return {
    total: list.length,
    free: list.filter(isFreeEvent).length,
    categories: new Set(list.map((e) => String(e.type ?? "").trim()).filter(Boolean)).size,
    unpaid: registered.filter((r) => !isRegistrationPaid(r)).length,
    thisWeek: dated.length > 0 ? upcoming.filter((x) => x.days <= 7).length : null,
    next: upcoming[0] ?? null,
  };
}

/**
 * HTML document that auto-logs into Event Hub (via a hidden form POST to
 * mainDashboard) inside the current window. Used to set the JSESSIONID cookie
 * on the eventhubcc origin so the browser can then hit authenticated URLs
 * (certificates, receipts, payment pages) directly — no backend proxying.
 */
export function eventHubLoginHtml(username: string, password: string): string {
  const u = username.replace(/"/g, "&quot;");
  const p = password.replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html>
<head>
    <title>Redirecting to Event Hub...</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #334155; }
        .loader { border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin-right: 12px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .container { display: flex; align-items: center; background: white; padding: 20px 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    </style>
</head>
<body>
    <div class="container">
        <div class="loader"></div>
        <p>Opening Event Hub securely...</p>
    </div>
    <form id="loginForm" action="https://eventhubcc.vit.ac.in/EventHub/mainDashboard" method="POST">
        <input type="hidden" name="username" value="${u}" />
        <input type="hidden" name="password" value="${p}" />
        <input type="hidden" name="validateVitian" value="1" />
    </form>
    <script>
        document.getElementById("loginForm").submit();
    </script>
</body>
</html>`;
}

