import { api } from "@/lib/sync-engine";

/**
 * Contribute this student's marks to their cohorts' running statistics.
 *
 * ## What this does and does not know
 *
 * The client sends marks. It does **not** decide identity and it does **not** decide
 * whether this is an add or a replace — the server derives the owner from the VTOP
 * session and decides that from a token it minted last time (see
 * `AmazeCC-API/src/lib/marksStats.ts`).
 *
 * So the wire payload is a flat list of "here is my current mark for this thing, and
 * here is what I last told you it was". There is no `userHash`, no `timestamp` and no
 * `type`. Dropping all three is the point: each was a place where a modified client
 * could influence what the server believed.
 *
 * ## The previous value
 *
 * `prevMark` is read from the marks snapshot taken *before* this sync. If that snapshot
 * is missing — a cleared cache, a first ever sync — it is sent as `null`, and the server
 * treats a missing claim conservatively: it will add, but it will not replace a
 * contribution it already holds. A student whose cache was cleared therefore keeps their
 * first recorded value rather than being counted twice.
 */

const getNumericValue = (value: any, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getAssessmentTotals = (assessments: any[]) =>
  assessments.reduce(
    (acc, asm) => {
      acc.max += getNumericValue(asm.maxMark);
      acc.scored += getNumericValue(asm.scoredMark);
      acc.weightPercent += getNumericValue(asm.weightagePercent);
      acc.weighted += getNumericValue(asm.weightageMark);
      return acc;
    },
    { max: 0, scored: 0, weightPercent: 0, weighted: 0 }
  );

const getCourseCredits = (course: any) => {
  const credits = getNumericValue(course?.credits, -1);
  return credits > 0 ? credits : -1;
};

/** Percentage of the weightage released so far, or 0 when nothing has been released. */
const normalisedPct = (earned: number, available: number) =>
  available > 0 ? (earned / available) * 100 : 0;

/** The blended course total: credit-weighted across the theory and lab halves. */
const overallPct = (group: any): number => {
  const theoryTotals = getAssessmentTotals(group.theory?.assessments || []);
  const labTotals = getAssessmentTotals(group.lab?.assessments || []);

  if (!group.lab) return normalisedPct(theoryTotals.weighted, theoryTotals.weightPercent);
  if (!group.theory) return normalisedPct(labTotals.weighted, labTotals.weightPercent);

  const theoryCredits = getCourseCredits(group.theory);
  const labCredits = getCourseCredits(group.lab);
  if (theoryCredits < 0 || labCredits < 0) return 0;

  const total = theoryCredits + labCredits;
  const earned = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / total;
  const available =
    (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / total;

  return normalisedPct(earned, available);
};

/** A single assessment's mark as a percentage of its maximum. */
const assessmentPct = (asm: any) =>
  getNumericValue(asm?.maxMark) > 0
    ? (getNumericValue(asm.scoredMark) / getNumericValue(asm.maxMark)) * 100
    : 0;

export type CourseGroupLite = {
  theory?: { classNbr?: string; assessments?: any[] } | null;
  lab?: { classNbr?: string; assessments?: any[] } | null;
};

export type RemappedStats = Record<
  string,
  { overall: { count: number; mean: number; sd: number } | null; assessments: Record<string, any> }
>;

/**
 * Re-key the server's cohort payload into what the course pages read.
 *
 * The server keys assessments by digest and carries the overall figure flat on the
 * entry (`{ count, mean, sd, assessments }`). The pages read `overall` plus an
 * assessment map keyed by VTOP title, so this translates between the two.
 *
 * Kept as a pure, exported function — and unit-tested — because the previous version
 * of this logic lived inline and read `entry.overall`, a key the server never sends.
 * The `?? null` fallback turned that into permanent, silent "no data".
 */
export const remapCohortStats = async (
  stored: Record<string, any>,
  uniqueCourses: CourseGroupLite[]
): Promise<RemappedStats> => {
  const remapped: RemappedStats = {};

  for (const [classId, entry] of Object.entries<any>(stored ?? {})) {
    const assessments: Record<string, any> = {};
    const groups = uniqueCourses.filter(
      (g) => (g.theory || g.lab)?.classNbr === classId
    );

    for (const g of groups) {
      for (const component of ["theory", "lab"] as const) {
        const list = g[component]?.assessments;
        if (!Array.isArray(list)) continue;
        for (const asm of list) {
          const key = await assessmentKeyFor(
            classId,
            component,
            String(asm?.title ?? "")
          );
          const hit = entry?.assessments?.[key];
          if (hit) assessments[asm.title] = hit;
        }
      }
    }

    const overall =
      entry && Number.isFinite(Number(entry.count))
        ? {
            count: Number(entry.count),
            mean: Number(entry.mean ?? 0),
            sd: Number(entry.sd ?? 0),
          }
        : null;

    remapped[classId] = { overall, assessments };
  }

  return remapped;
};

/**
 * The key an assessment's cohort statistics are stored and read back under.
 *
 * **This mirrors `assessmentKeyFor` in `AmazeCC-API/src/lib/marksStats.ts` and the two
 * must stay byte-identical** — if they drift, every read silently misses and the UI falls
 * back to "not enough data" with nothing to indicate why.
 *
 * A plain SHA-256, not an HMAC: the client cannot compute an HMAC under a server-only
 * salt, and it has to be able to derive this to join a statistic back to the assessment it
 * is rendering. The input is a course-level constant shared by everyone in the cohort, so
 * there is nothing sensitive in it.
 */
export const assessmentKeyFor = async (
  classId: string,
  component: string,
  title: string
): Promise<string> => {
  const normalised = title.trim().replace(/\s+/g, " ");
  const data = new TextEncoder().encode([classId, component, normalised].join("::"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
};

type CourseGroup = { theory?: any; lab?: any };

/**
 * Split the flat `courses[]` VTOP returns into theory/lab halves per course code.
 *
 * A component is lab when VTOP says so, or — as the scraper's own heuristic does — when
 * its slot starts with `L`. `component` travels with every contribution because the two
 * halves of an embedded course carry the same course code and frequently the same
 * assessment titles; without it their statistics merge.
 */
const buildMap = (marksData: any): Map<string, CourseGroup> => {
  const map = new Map<string, CourseGroup>();
  if (!marksData?.courses || !Array.isArray(marksData.courses)) return map;

  marksData.courses.forEach((c: any) => {
    if (!c || typeof c !== "object") return;
    const code = String(c.courseCode || "");
    if (!code) return;

    const type = String(c.courseType || "").toLowerCase();
    const slot = String(c.slot || "").toLowerCase();
    const isLab = type.includes("lab") || slot.startsWith("l");

    const group = map.get(code) ?? {};
    if (isLab) group.lab = c;
    else group.theory = c;
    map.set(code, group);
  });

  return map;
};

/** Push one contribution, collapsing a no-op so the server does no needless work. */
function push(
  out: any[],
  classId: string,
  scope: "overall" | "assessment",
  component: string,
  title: string,
  mark: number,
  prev: number | null,
  force = false
) {
  if (!classId) return;
  if (!Number.isFinite(mark) || mark <= 0) return;
  // Re-sending an unchanged value would make the server do a remove-then-add of the
  // same number. Harmless, but it is a write we do not need to make — unless this is
  // the one-time backfill below, which exists precisely to state every value once.
  if (!force && prev !== null && Math.abs(prev - mark) < 1e-9) return;

  out.push({
    classId,
    scope,
    component,
    title,
    mark,
    prevMark: prev,
  });
}

/**
 * One-time backfill marker.
 *
 * Per-assessment statistics only arrive when a mark *changes*, so a course whose marks
 * are stable would otherwise never contribute. The first sync after this version sends
 * every scored assessment once, regardless of change; the server reconciles each
 * against any legacy record (or adds it), mints a token, and every later sync resumes
 * normal diffing. Set only on `res.ok`, so a failed backfill retries next time.
 */
const BACKFILL_KEY = "marksSyncBackfillV1";

/** Receipt keys the last successful sync reported as frozen (server-held, not covered). */
const FROZEN_KEY = "marksFrozenV1";

export function getFrozenKeys(): string[] {
  try {
    const raw = localStorage.getItem(FROZEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

/** Server-minted HMACs, keyed `${classId}::${scope}::${assessmentKey}`. */
const TOKENS_KEY = "marksTokensV1";

export type TokenMap = Record<string, string>;

export function getStoredTokens(): TokenMap {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as TokenMap;
  } catch {
    return {};
  }
}

function setStoredTokens(tokens: TokenMap): void {
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } catch {}
}

export type MarksSyncResult = {
  tally: Record<string, number>;
  /**
   * Receipt keys where the server's new token differs from what we held *without us
   * changing the mark* — i.e. server state moved under us (restored backup, lost
   * write, bug). Changed marks legitimately mint new tokens and are never listed.
   */
  mismatches: string[];
  /**
   * Receipt keys the server holds (per the last bootstrap or sync) that this sync did
   * not cover — assessments whose contributions this device cannot update, because it
   * has no previous mark to state. Frozen, not lost: the values stand as recorded.
   */
  frozen: string[];
};

/**
 * Receipt key for one contribution. Mirrors the server's minting
 * (`${classId}::${scope}::${assessmentKey}`) so the two can be compared without the
 * client recomputing anything at read time.
 */
async function receiptKeyFor(
  classId: string,
  scope: "overall" | "assessment",
  component: string,
  title: string
): Promise<string> {
  // Must match AmazeCC-API `OVERALL_KEY`.
  const key =
    scope === "overall" ? "overall" : await assessmentKeyFor(classId, component, title);
  return `${classId}::${scope}::${key}`;
}

/**
 * Ask the server what HMACs it currently holds for this student.
 *
 * This is the re-bootstrap half of the handshake: a client that has lost its local
 * record (cleared cache, new device) learns exactly which contributions exist
 * server-side. What comes back is presence and continuity — opaque tokens, never
 * values. An HMAC is non-invertible by construction, so no response here can hand back
 * a mark nobody retained; exact resumption still needs the old value, and after a wipe
 * nobody has it. See `remapCohortStats`'s module doc for the full reasoning.
 */
async function bootstrapTokens(): Promise<TokenMap> {
  try {
    const res = (await api("marks/tokens", {
      method: "POST",
      body: {},
      auth: "vtop",
      parse: "raw",
    })) as Response;
    if (!res.ok) return {};
    const payload = await res.json().catch(() => null);
    if (!payload?.success || !Array.isArray(payload.tokens)) return {};

    const out: TokenMap = {};
    for (const t of payload.tokens) {
      if (!t || typeof t !== "object") continue;
      const { classId, scope, assessmentKey, token } = t as {
        classId?: unknown;
        scope?: unknown;
        assessmentKey?: unknown;
        token?: unknown;
      };
      if (
        typeof classId !== "string" ||
        (scope !== "overall" && scope !== "assessment") ||
        typeof assessmentKey !== "string" ||
        typeof token !== "string"
      ) {
        continue;
      }
      out[`${classId}::${scope}::${assessmentKey}`] = token;
    }
    return out;
  } catch {
    return {};
  }
}

export const syncMarksDiff = async (
  oldMarksData: any,
  newMarksData: any
): Promise<MarksSyncResult> => {
  const empty: MarksSyncResult = { tally: {}, mismatches: [], frozen: [] };
  if (!newMarksData?.courses) return empty;

  let backfill = false;
  try {
    backfill = localStorage.getItem(BACKFILL_KEY) !== "true";
  } catch {}

  try {
    const oldMap = buildMap(oldMarksData);
    const newMap = buildMap(newMarksData);
    const contributions: any[] = [];

    newMap.forEach((newGroup, courseCode) => {
      const oldGroup = oldMap.get(courseCode) ?? {};

      // Both halves report under the theory component's class id, which is what the
      // reader looks the course up by too.
      const classId = String(newGroup.theory?.classNbr || newGroup.lab?.classNbr || "");
      if (!classId) return;

      push(
        contributions,
        classId,
        "overall",
        "",
        "",
        overallPct(newGroup),
        oldGroup.theory || oldGroup.lab ? overallPct(oldGroup) : null,
        backfill
      );

      for (const component of ["theory", "lab"] as const) {
        const fresh = newGroup[component]?.assessments;
        if (!Array.isArray(fresh)) continue;

        const stale = new Map<string, any>(
          (oldGroup[component]?.assessments ?? []).map((a: any) => [
            String(a?.title ?? ""),
            a,
          ])
        );

        for (const asm of fresh) {
          const title = String(asm?.title ?? "");
          if (!title) continue;

          const previous = stale.get(title);
          push(
            contributions,
            classId,
            "assessment",
            component,
            title,
            assessmentPct(asm),
            previous ? assessmentPct(previous) : null,
            backfill
          );
        }
      }
    });

    if (contributions.length === 0) {
      // Nothing to send, but the store may still hold keys from an earlier sync —
      // those are uncovered by definition, so report them as frozen rather than
      // claiming a clean bill. Bootstrap only when the store itself is empty.
      const stored = getStoredTokens();
      const storedKeys = Object.keys(stored);
      let frozen: string[];
      if (storedKeys.length === 0) {
        const fresh = await bootstrapTokens();
        if (Object.keys(fresh).length > 0) setStoredTokens(fresh);
        frozen = Object.keys(fresh);
      } else {
        frozen = storedKeys;
      }
      // Persisted like every other path: the UI badge reads the stored list, not a
      // return value it never sees.
      try {
        localStorage.setItem(FROZEN_KEY, JSON.stringify(frozen));
      } catch {}
      return { tally: {}, mismatches: [], frozen };
    }

    const res = (await api("marks/sync", {
      method: "POST",
      body: { contributions },
      auth: "vtop",
      parse: "raw",
    })) as Response;

    if (!res.ok) {
      // 401 here means the VTOP session went stale between the marks fetch and this
      // call. The caller already has a live session in hand — the marks fetch used it
      // moments ago — so a failure here is logged and dropped rather than surfaced.
      // Nothing is lost: the next sync recomputes from the marks snapshot.
      console.warn("marks/sync rejected:", res.status);
      return empty;
    }

    const payload = await res.json().catch(() => null);
    const tally: Record<string, number> =
      payload && typeof payload.tally === "object" ? payload.tally : {};
    const returned: TokenMap =
      payload && typeof payload.tokens === "object" ? payload.tokens : {};

    // ── receipt check ──────────────────────────────────────────────────────
    // For contributions sent unchanged (mark == prevMark), the server must echo back
    // the token we already hold: remove-then-add of the same number leaves the mint
    // identical. A difference means server state moved without us — restored backup,
    // lost write, bug — and is worth flagging rather than absorbing. Changed marks
    // legitimately mint new tokens and are never listed.
    const stored = getStoredTokens();
    const mismatches: string[] = [];
    const sentKeys = new Set<string>();
    for (const c of contributions) {
      const key = await receiptKeyFor(c.classId, c.scope, c.component, c.title);
      sentKeys.add(key);
      const had = stored[key];
      const got = returned[key];
      if (
        had !== undefined &&
        got !== undefined &&
        had !== got &&
        c.prevMark !== null &&
        Math.abs(Number(c.prevMark) - Number(c.mark)) < 1e-9
      ) {
        mismatches.push(key);
      }
    }
    if (mismatches.length > 0) {
      console.warn(
        `[marks/sync] ${mismatches.length} token(s) changed without a mark change — server state moved:`,
        mismatches
      );
    }

    // File the receipts, then top up anything this batch did not cover — but only
    // when the store started empty. The sync response carries tokens solely for
    // accepted writes; keys the server holds that we did not touch (skipped as
    // frozen, or simply unchanged elsewhere) would otherwise stay unknown forever.
    // Steady-state syncs skip this entirely: one extra call only when needed.
    const merged = { ...stored, ...returned };
    if (Object.keys(stored).length === 0) {
      const fresh = await bootstrapTokens();
      for (const [k, v] of Object.entries(fresh)) {
        if (!(k in merged)) merged[k] = v;
      }
    }
    setStoredTokens(merged);

    // Frozen: server-held keys this sync did not cover. These are contributions the
    // device cannot update — no previous mark to state — so they stand as recorded.
    const frozen = Object.keys(merged).filter((k) => !sentKeys.has(k));

    // Mark the backfill done only on success, so a failed attempt retries next sync.
    if (backfill) {
      try {
        localStorage.setItem(BACKFILL_KEY, "true");
      } catch {}
    }

    // Persist the frozen set so the UI can show it without recomputing: these are
    // contributions the server holds that this device cannot update.
    try {
      localStorage.setItem(FROZEN_KEY, JSON.stringify(frozen));
    } catch {}

    return { tally, mismatches, frozen };
  } catch (e) {
    console.error("Error during background marks sync:", e);
    return empty;
  }
};