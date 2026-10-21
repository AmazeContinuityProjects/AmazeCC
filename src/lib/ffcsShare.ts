import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { AddedCourse, TimetableState } from "@/components/custom/exams/FFCS/types";
import { GLOBAL_CAMPUS } from "@/lib/campusSchema";

/**
 * Share links: one timetable, compressed into the URL itself.
 *
 * ## Why the URL carries everything
 *
 * A static export has no server to hold a share id, and a link that needs one
 * is a link that dies with its host. Compressing the plan into the path means
 * a shared link works forever, offline, for anyone — and the payload is the
 * same local-first data the planner already keeps in this browser.
 *
 * ## What travels, and what does not
 *
 * Only the week being shared: its name and its placed courses, field-picked
 * down to what the grid needs. Not the student's other timetables, not their
 * friends, not their locks, not metrics (the receiver recomputes those from
 * the courses against the schema in the payload). A share link is an
 * invitation to look at one plan, not an export of the planner.
 *
 * ## Versioning
 *
 * `v` is checked exactly, and a mismatch decodes to `null` rather than a best
 * guess: this payload renders a timetable, and a timetable half-understood
 * (which field means what) is worse than a link that says "can't read this".
 * Bump {@link FFCS_SHARE_VERSION} whenever the wire shape changes and old
 * links should stop parsing rather than misparse.
 */

export const FFCS_SHARE_VERSION = 1;

/**
 * URL length past which WhatsApp/QR encoders start mangling links.
 *
 * Not a hard limit — the decode side takes whatever arrives — but a warning
 * the sender deserves: past this, "why didn't my friend's link work" becomes
 * the likeliest support question.
 */
export const FFCS_SHARE_WARN_LENGTH = 8000;

interface ShareWire {
  v: number;
  /** Campus whose schema the plan was built against. */
  c: string;
  n: string;
  k: AddedCourse[];
}

/** Known fields only — a course from a future version travels as what it is. */
function asCourse(raw: unknown): AddedCourse | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.code !== "string" || c.code.length === 0) return null;
  if (!Array.isArray(c.slots) || !c.slots.every((s) => typeof s === "string")) return null;
  return {
    id: typeof c.id === "string" && c.id ? c.id : `share-${c.code}`,
    code: c.code,
    title: typeof c.title === "string" ? c.title : "",
    slots: c.slots as string[],
    faculty: typeof c.faculty === "string" ? c.faculty : "",
    venue: typeof c.venue === "string" ? c.venue : "",
    credits: typeof c.credits === "string" ? c.credits : "",
    type: typeof c.type === "string" ? c.type : "",
    color: typeof c.color === "string" ? c.color : "",
    ...(typeof c.batch === "string" ? { batch: c.batch } : {}),
  };
}

/** Compresses one timetable into the `d=` parameter of a share URL. */
export function encodeTimetableShare(
  timetable: Pick<TimetableState, "name" | "courses">,
  campus: string = GLOBAL_CAMPUS
): string {
  const wire: ShareWire = {
    v: FFCS_SHARE_VERSION,
    c: campus,
    n: timetable.name,
    k: timetable.courses,
  };
  return compressToEncodedURIComponent(JSON.stringify(wire));
}

/**
 * Inverse of {@link encodeTimetableShare}, validating every field.
 *
 * Returns null for anything unreadable — tampered, truncated, or written by
 * a version this one does not understand. The timetable gets a fresh id on
 * the way out so importing a shared plan twice yields two plans, not a
 * silent overwrite.
 */
export function decodeTimetableShare(
  encoded: string
): { timetable: TimetableState; campus: string } | null {
  if (!encoded) return null;
  let wire: unknown;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    wire = JSON.parse(json);
  } catch {
    return null;
  }
  if (!wire || typeof wire !== "object") return null;
  const w = wire as Record<string, unknown>;
  if (w.v !== FFCS_SHARE_VERSION) return null;
  if (typeof w.n !== "string" || !Array.isArray(w.k)) return null;

  const courses = w.k.map(asCourse).filter((c): c is AddedCourse => c !== null);
  if (courses.length === 0) return null;

  return {
    timetable: {
      id: `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: w.n,
      courses,
    },
    campus: typeof w.c === "string" && w.c ? w.c : GLOBAL_CAMPUS,
  };
}

/**
 * The full URL for an encoded plan.
 *
 * Honours `NEXT_PUBLIC_BASE_PATH` because the same static build can land at a
 * domain root or under `/<repo>/` on GitHub Pages — a link built from
 * `origin` alone silently 404s in the second case.
 */
export function buildShareUrl(encoded: string, origin: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
  const host = origin.replace(/\/+$/, "");
  return `${host}${base}/share/ffcs/?d=${encoded}`;
}

/** Whether a built link is long enough to warn the sender about. */
export function isOversizedShareLink(url: string): boolean {
  return url.length > FFCS_SHARE_WARN_LENGTH;
}
