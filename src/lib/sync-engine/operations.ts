import { storage } from "../storage";
import { credentialManager } from "./credential-manager";
import { registerOp, type OpCtx } from "./operation-registry";
import { dataAtoms } from "./state-bridge";
import { toEngineError, assertApiSuccess } from "./errors";
import {
  clearPeerTimetables,
  writeGrants,
  writeIdentity,
  writeOwnTimetable,
  writePeers,
} from "../social/storage";
import type { SocialSyncPayload } from "../social/types";
import { getActiveRegNumber } from "../social/identity";
import { activeRegNumberAtom } from "../../store/socialAtoms";
import {
  socialGrantsAtom,
  socialIdentityAtom,
  socialOwnBusyMapAtom,
  socialOwnCoursesAtom,
  socialPeersAtom,
  socialSyncStateAtom,
} from "../../store/socialAtoms";

/**
 * The term the last successful social sync wrote. Module-level because the
 * cache is global to the app, and comparing against the freshly-derived
 * identity is how we notice the user switched semesters.
 */
let cachedSemester: string | null = null;

/**
 * Run one request with its own start/done/error emits so the sync log shows
 * per-module results instead of a single opaque parent-op line.
 */
async function trackedRequest<T>(
  ctx: OpCtx,
  opName: string,
  request: () => Promise<T>
): Promise<T> {
  ctx.emit({ op: opName, phase: "start" });
  try {
    const result = await request();
    ctx.emit({ op: opName, phase: "done" });
    return result;
  } catch (e) {
    ctx.emit({ op: opName, phase: "error", error: toEngineError(e) });
    throw e;
  }
}

function settledValue<T>(r: PromiseSettledResult<T>): T | null {
  return r.status === "fulfilled" ? r.value : null;
}

function persist(key: string, value: unknown): void {
  const bucket = (storage as any)[key];
  bucket?.set?.(value);
}

// attendance + marks (combined, as the original fetchAttendanceAndMarks)
registerOp({
  name: "attendanceMarks",
  auth: "vtop",
  critical: true,
  meta: {
    label: "Attendance & Marks",
    description: "Current-semester attendance and marks — the daily check.",
    category: "academics",
    cost: "heavy",
    needsSemester: true,
  },
  async run(ctx, args) {
    const semesterId = args?.semesterId as string;
    const data = await ctx.request(
      "attendance",
      { semesterId },
      { auth: "vtop", retry: { max: 1 } },
    );
    if (!data?.attRes || !data.attRes.attendance) {
      throw new Error("Session verification failed. Please try again.");
    }
    if (data.marksRes && typeof data.marksRes === "string") {
      throw new Error(`Marks fetch failed: ${data.marksRes}`);
    }
    persist("attendance", data.attRes);
    persist("marks", data.marksRes);
    ctx.bridge.setAtom(dataAtoms.attendanceDataAtom, data.attRes);
    ctx.bridge.setAtom(dataAtoms.marksDataAtom, data.marksRes);
    return { attRes: data.attRes, marksRes: data.marksRes };
  },
});

// Cohort marks statistics, per class.
//
// Runs after `attendanceMarks` because the class list comes from the marks it just
// fetched — current marks plus every frozen past semester. Using `ctx.request` (not the
// bare `api()`) is what makes this robust where the old component-level call was not:
// credentials are injected by the engine, failures are classified into AuthError vs
// TransientError with retry, and the sync log shows the outcome per module.
//
// The server verifies each requested class against the enrollment recorded during the
// attendance fetch, so the `classIds` parameter cannot be used to enumerate a cohort
// the caller does not belong to.
registerOp({
  name: "marksStats",
  auth: "vtop",
  meta: {
    label: "Cohort statistics",
    description: "Per-class cohort marks stats, merged over cached terms.",
    category: "academics",
    cost: "medium",
  },
  async run(ctx) {
    const ids = new Set<string>();

    const collect = (courses: unknown) => {
      if (!Array.isArray(courses)) return;
      for (const c of courses) {
        const id =
          c && typeof c === "object"
            ? (c as { classNbr?: unknown }).classNbr
            : undefined;
        if (typeof id === "string" && id.length > 0) ids.add(id);
      }
    };

    try {
      const current = storage.marks.get() as { courses?: unknown } | null;
      collect(current?.courses);
    } catch {}

    // Frozen past semesters live under `frozen_marks_<semId>` (see pastDataSync).
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("frozen_marks_")) continue;
        try {
          const data = JSON.parse(localStorage.getItem(key) || "null") as {
            courses?: unknown;
          } | null;
          collect(data?.courses);
        } catch {}
      }
    } catch {}

    const classIds = [...ids].slice(0, 100);
    if (classIds.length === 0) return { stats: {} };

    const res = await trackedRequest(ctx, "marksStats", () =>
      ctx
        .request("marks/stats", { classIds }, { auth: "vtop" })
        .then((r: any) => (assertApiSuccess(r, "Cohort statistics"), r))
    );

    const fresh = (res as { stats?: Record<string, unknown> })?.stats ?? {};
    const prev =
      (ctx.bridge.getAtom(dataAtoms.marksStatsAtom) as Record<string, unknown>) ??
      {};
    // Merge, never overwrite: a failed fetch for one semester must not wipe the
    // classes another one already resolved.
    const merged = { ...prev, ...fresh };
    persist("marksStats", merged);
    ctx.bridge.setAtom(dataAtoms.marksStatsAtom, merged);
    return { stats: merged };
  },
});

// --- Core bundle children -------------------------------------------------
//
// Each module below is BOTH a standalone op (so sync modes can pick them
// individually) AND the implementation `core` delegates to. The
// `trackedRequest` child emits are identical either way, so the sync log
// looks the same whether `grades` ran alone or inside `core`.

async function fetchGrades(ctx: OpCtx, semesterId: string) {
  return trackedRequest(ctx, "grades", () =>
    ctx
      .request("grades", { semesterId }, { auth: "vtop" })
      .then((r: any) => (assertApiSuccess(r, "Grades"), r)),
  );
}

async function fetchSchedule(ctx: OpCtx, semesterId: string) {
  return trackedRequest(ctx, "schedule", () =>
    ctx
      .request("schedule", { semesterId }, { auth: "vtop" })
      .then((r: any) => (assertApiSuccess(r, "Exam schedule"), r)),
  );
}

async function fetchHostel(ctx: OpCtx) {
  return trackedRequest(ctx, "hostel", () => ctx.request("hostel", {}, { auth: "vtop" }));
}

async function fetchCalendar(ctx: OpCtx, semesterId: string, calendarType: string) {
  return trackedRequest(ctx, "calendar", () =>
    ctx
      .request("calendar", { type: calendarType, semesterId }, { auth: "vtop" })
      .then((r: any) => (assertApiSuccess(r, "Academic calendar"), r)),
  );
}

async function fetchAllGrades(ctx: OpCtx) {
  return trackedRequest(ctx, "all-grades", () =>
    ctx
      .request("all-grades", {}, { auth: "vtop" })
      .then((r: any) => (assertApiSuccess(r, "All grades history"), r)),
  );
}

async function fetchProfileImages(ctx: OpCtx) {
  return trackedRequest(ctx, "profile-images", () =>
    ctx
      .request("profile-images", {}, { auth: "vtop", retry: { max: 0 } })
      .then(async (r: any) => (r?.success ? r : null))
      .catch(() => null),
  );
}

/** The six modules `core` bundles, in bundle order. */
export const CORE_CHILD_OPS = [
  "grades",
  "schedule",
  "hostel",
  "calendar",
  "all-grades",
  "profile-images",
] as const;

export type CoreChildOp = (typeof CORE_CHILD_OPS)[number];

function coreChildArgs(args: Record<string, unknown> | undefined): {
  semesterId: string;
  calendarType: string;
  isHosteller: boolean;
} {
  return {
    semesterId: args?.semesterId as string,
    calendarType: (args?.calendarType as string) || "ALL",
    isHosteller: args?.isHosteller as boolean,
  };
}

registerOp({
  name: "grades",
  auth: "vtop",
  meta: {
    label: "Grades",
    description: "Current-semester grades breakdown.",
    category: "academics",
    cost: "medium",
    needsSemester: true,
  },
  async run(ctx, args) {
    const res = await fetchGrades(ctx, args?.semesterId as string);
    if (res !== null && res !== undefined) {
      persist("grades", res);
      ctx.bridge.setAtom(dataAtoms.gradesDataAtom, res);
    }
    return res;
  },
});

registerOp({
  name: "schedule",
  auth: "vtop",
  meta: {
    label: "Exam schedule",
    description: "Exam timetable for the active semester.",
    category: "academics",
    cost: "medium",
    needsSemester: true,
  },
  async run(ctx, args) {
    const res = await fetchSchedule(ctx, args?.semesterId as string);
    if (res !== null && res !== undefined) {
      persist("schedule", res);
      ctx.bridge.setAtom(dataAtoms.scheduleDataAtom, res);
    }
    return res;
  },
});

registerOp({
  name: "hostel",
  auth: "vtop",
  meta: {
    label: "Hostel details",
    description: "Room, mess, laundry and leave data.",
    category: "stay",
    cost: "medium",
  },
  async run(ctx) {
    const res = await fetchHostel(ctx);
    if (res !== null && res !== undefined) {
      persist("hostel", res);
      ctx.bridge.setAtom(dataAtoms.hostelDataAtom, res);
    }
    return res;
  },
});

registerOp({
  name: "calendar",
  auth: "vtop",
  meta: {
    label: "Academic calendar",
    description: "Milestone dates and academic calendar.",
    category: "academics",
    cost: "medium",
    needsSemester: true,
  },
  async run(ctx, args) {
    const { semesterId, calendarType } = coreChildArgs(args);
    const res = await fetchCalendar(ctx, semesterId, calendarType);
    if (res !== null && res !== undefined) {
      persist("calendar", res);
      ctx.bridge.setAtom(dataAtoms.calendarDataAtom, res);
    }
    return res;
  },
});

registerOp({
  name: "all-grades",
  auth: "vtop",
  meta: {
    label: "All grades history",
    description: "Every semester's grades — feeds past-semester caches.",
    category: "academics",
    cost: "medium",
  },
  async run(ctx) {
    const res = await fetchAllGrades(ctx);
    if (res !== null && res !== undefined) {
      persist("allGrades", res);
      ctx.bridge.setAtom(dataAtoms.allGradesDataAtom, res);
    }
    return res;
  },
});

registerOp({
  name: "profile-images",
  auth: "vtop",
  meta: {
    label: "Profile images",
    description: "Best-effort profile photos; never fails a sync.",
    category: "profile",
    cost: "light",
  },
  async run(ctx) {
    const res = await fetchProfileImages(ctx);
    if (res) persist("profileImages", res);
    return res;
  },
});

// core data: grades / schedule / hostel / calendar / allGrades / profileImages
registerOp({
  name: "core",
  auth: "vtop",
  critical: true,
  meta: {
    label: "Core data bundle",
    description: "Grades, schedule, hostel, calendar, history and photos in one bundle.",
    category: "profile",
    cost: "heavy",
    needsSemester: true,
  },
  async run(ctx, args) {
    const { semesterId, calendarType, isHosteller } = coreChildArgs(args);
    // Granular subset: `syncMode("academics")` and custom modes pass
    // `only` to fetch some modules without the whole bundle.
    const only = args?.only as string[] | undefined;
    const wanted = new Set<CoreChildOp>(
      only && only.length > 0
        ? (only.filter((n) => (CORE_CHILD_OPS as readonly string[]).includes(n)) as CoreChildOp[])
        : [...CORE_CHILD_OPS],
    );
    const runOrSkip = <T>(name: CoreChildOp, fn: () => Promise<T>): Promise<T | null> =>
      wanted.has(name) ? fn() : Promise.resolve(null);
    // Settle independently: one failing module must not take down the whole
    // bundle, and failures already emitted their own child error lines above.
    const [gradesSettled, scheduleSettled, hostelSettled, calendarSettled, allGradesSettled, profileImagesSettled] =
      await Promise.allSettled([
        runOrSkip("grades", () => fetchGrades(ctx, semesterId)),
        runOrSkip("schedule", () => fetchSchedule(ctx, semesterId)),
        wanted.has("hostel")
          ? isHosteller
            ? fetchHostel(ctx)
            : Promise.resolve({})
          : Promise.resolve(null),
        runOrSkip("calendar", () => fetchCalendar(ctx, semesterId, calendarType)),
        runOrSkip("all-grades", () => fetchAllGrades(ctx)),
        runOrSkip("profile-images", () => fetchProfileImages(ctx)),
      ]);
    const gradesRes = settledValue(gradesSettled);
    const scheduleRes = settledValue(scheduleSettled);
    const hostelRes = settledValue(hostelSettled);
    const calendarRes = settledValue(calendarSettled);
    const allGradesRes = settledValue(allGradesSettled);
    const profileImagesRes = settledValue(profileImagesSettled);
    // Never persist nulls over good cached data — a failed module keeps its
    // last good cache while the log shows exactly what failed.
    const persistIfPresent = (key: string, value: unknown) => {
      if (value !== null && value !== undefined) persist(key, value);
    };
    persistIfPresent("grades", gradesRes);
    persistIfPresent("schedule", scheduleRes);
    persistIfPresent("hostel", hostelRes);
    persistIfPresent("calendar", calendarRes);
    persistIfPresent("allGrades", allGradesRes);
    if (profileImagesRes) persist("profileImages", profileImagesRes);
    const setAtomIfPresent = (atom: unknown, value: unknown) => {
      if (value !== null && value !== undefined) ctx.bridge.setAtom(atom, value);
    };
    setAtomIfPresent(dataAtoms.gradesDataAtom, gradesRes);
    setAtomIfPresent(dataAtoms.scheduleDataAtom, scheduleRes);
    setAtomIfPresent(dataAtoms.hostelDataAtom, hostelRes);
    setAtomIfPresent(dataAtoms.calendarDataAtom, calendarRes);
    setAtomIfPresent(dataAtoms.allGradesDataAtom, allGradesRes);
    return { gradesRes, scheduleRes, hostelRes, calendarRes, allGradesRes, profileImagesRes };
  },
});

registerOp({
  name: "officialOd",
  auth: "vtop",
  meta: {
    label: "Official OD records",
    description: "On-duty records for the active semester.",
    category: "campus",
    cost: "light",
    needsSemester: true,
  },
  async run(ctx, args) {
    const semesterId = args?.semesterId as string;
    if (!semesterId) return null;
    try {
      const data = await ctx.request("od", { semesterId }, { auth: "vtop", retry: { max: 1 } });
      if (data?.success === false) return null;
      const payload = { success: true, semesterId, totalCount: data?.totalCount ?? 0, note: data?.note ?? null, records: data?.records ?? [] };
      try {
        storage.officialOd.set(semesterId, payload);
      } catch {}
      ctx.bridge.setAtom(dataAtoms.officialOdDataAtom, payload);
      return payload;
    } catch {
      return null;
    }
  },
});

registerOp({
  name: "studentProfile",
  auth: "vtop",
  meta: {
    label: "Profile details",
    description: "Student profile; publishes the active reg number.",
    category: "profile",
    cost: "light",
  },
  async run(ctx) {
    try {
      const data = await ctx.request("student", {}, { auth: "vtop", retry: { max: 0 } });
      if (data?.profile) {
        persist("profile", data.profile);
        // Now that the profile exists, publish the reg number it resolves to.
        // Every social storage key is namespaced by it, and components that
        // read it during their first render saw "" and had no reactive way to
        // retry — leaving the social page empty until a remount.
        ctx.bridge.setAtom(activeRegNumberAtom, getActiveRegNumber());
        return data.profile;
      }
    } catch {
      /* background fetch */
    }
    return null;
  },
});

registerOp({
  name: "pastAttendance",
  auth: "vtop",
  meta: {
    label: "Past semester attendance",
    description: "Freezes attendance for every older semester.",
    category: "profile",
    cost: "heavy",
    needsSemester: true,
  },
  async run(ctx, args) {
    const allGradesRes = (args?.allGradesRes as { grades?: Record<string, unknown> }) || (storage.allGrades.get() as any) || {};
    const currSemesterID = args?.semesterId as string;
    const pastSemesters = Object.keys(allGradesRes?.grades || {}).filter((s) => s !== currSemesterID);
    if (pastSemesters.length === 0) return;
    await Promise.allSettled(
      pastSemesters.map((sem) =>
        ctx
          .request("attendance", { semesterId: sem }, { auth: "vtop", retry: { max: 0 } })
          .then((d: any) => {
            if (d?.attendance) storage.frozenAttendance.set(sem, d);
          })
          .catch(() => {}),
      ),
    );
  },
});

registerOp({
  name: "fresher",
  auth: "vtop",
  meta: {
    label: "Fresher / EPT data",
    description: "EPT schedule and acknowledgement records.",
    category: "campus",
    cost: "light",
  },
  async run(ctx) {
    try {
      // Both ride in one invocation via /api/bulk instead of two requests.
      const res = await ctx.request(
        "bulk",
        { endpoints: ["ept-schedule", "acknowledgement"] },
        { auth: "vtop", retry: { max: 0 } }
      );
      const results = (res as { results?: Record<string, { success?: boolean }> } | null)?.results ?? {};
      if (results["ept-schedule"]?.success) storage.cache.set("ept_schedule", results["ept-schedule"]);
      if (results["acknowledgement"]?.success) storage.cache.set("acknowledgement", results["acknowledgement"]);
    } catch {
      /* fail silently */
    }
  },
});

registerOp({
  name: "buses",
  auth: "none",
  meta: {
    label: "Bus routes",
    description: "Public bus routes — no login needed.",
    category: "stay",
    cost: "light",
  },
  async run(ctx) {
    try {
      const data = await ctx.request("buses", undefined, { method: "GET", auth: "none", retry: { max: 1 } });
      if (data?.success) storage.cache.set("buses", data.buses);
      return data?.buses ?? null;
    } catch {
      /* fail silently */
      return null;
    }
  },
});

registerOp({
  name: "transport",
  auth: "vtop",
  meta: {
    label: "Transport data",
    description: "Transport registration for the student.",
    category: "stay",
    cost: "medium",
  },
  async run(ctx) {
    const data = await ctx.request("transport", {}, { auth: "vtop" });
    persist("transportData", data);
    return data;
  },
});

registerOp({
  name: "events",
  auth: "eventhub",
  meta: {
    label: "Registered events",
    description: "Event Hub registrations plus the public catalogue.",
    category: "campus",
    cost: "medium",
  },
  async run(ctx, args) {
    const ids = ctx.ids;
    const demoMode = args?.demoMode as boolean;
    // Surfaced to the progress bus instead of being swallowed, so a 401 shows as
    // a failed op rather than as "you have no events".
    let session: string;
    try {
      // `ensureEventHubSession`, not `loginEventHub`: the latter returns a cached
      // session with no age check, so an expired one was reused forever and every
      // `/api/events/profile` call 401'd while the credentials were fine.
      session = await credentialManager.ensureEventHubSession(ids, { demoMode });
    } catch (e) {
      ctx.emit({ op: "events", phase: "error", error: toEngineError(e) });
      return { registeredEvents: [], eventHubEvents: [] };
    }
    try {
      const jsessionid = session;
      // Same contract as `eventHubRequest` (EventHubTab): the route needs
      // username/password alongside the session for its fallback login, and
      // answers `reauthenticate: true` when the session died. Sending only
      // `{ jsessionid }` 500'd server-side.
      const fetchProfile = (sid: string) =>
        ctx.request(
          "events/profile",
          {
            username: ids.VtopUsername,
            password: ids.VtopPassword,
            ...(sid ? { jsessionid: sid } : {}),
          },
          { auth: "none", retry: { max: 0 } }
        );
      const [eventsRes, publicEvents] = await Promise.all([
        (async () => {
          if (!jsessionid && (demoMode || ids.VtopUsername === "demo")) return { events: [] };
          let r: any = await fetchProfile(jsessionid);
          if ((r as { reauthenticate?: boolean } | null)?.reauthenticate) {
            credentialManager.clearEventHub();
            const fresh = await credentialManager
              .ensureEventHubSession(ids, { demoMode })
              .catch(() => "");
            r = await fetchProfile(fresh);
          }
          return r;
        })(),
        ctx.request("events", undefined, { method: "GET", auth: "none", retry: { max: 0 } }).catch(() => []),
      ]);
      // A 401 here means the session was rejected after we obtained it, so the
      // cached copy is now known-bad and must not be handed back next time.
      if ((eventsRes as { error?: string } | null)?.error) {
        credentialManager.clearEventHub();
      }
      if (eventsRes?.events) persist("registeredEvents", eventsRes.events);
      ctx.bridge.setAtom(dataAtoms.registeredEventsAtom, eventsRes?.events || []);
      ctx.bridge.setAtom(dataAtoms.eventHubEventsAtom, publicEvents || []);
      return { registeredEvents: eventsRes?.events || [], eventHubEvents: publicEvents || [] };
    } catch {
      return { registeredEvents: [], eventHubEvents: [] };
    }
  },
});

/** Bulk endpoints gated by `syncAdditionalData` (registrations). */
export const BULK_ADDITIONAL_ENDPOINTS = [
  "exc-registration",
  "minor-honour",
  "course-completion",
] as const;

/** Bulk endpoints gated by `syncProfileData` (profile + payments + library). */
export const BULK_PROFILE_ENDPOINTS = [
  "credentials",
  "registration-schedule",
  "dayboarder",
  "bank-info",
  "library-due",
  "hostel-counselling",
  "payments",
  "payment-receipts",
  "wallet",
] as const;

export const ALL_BULK_ENDPOINTS: readonly string[] = [
  ...BULK_ADDITIONAL_ENDPOINTS,
  ...BULK_PROFILE_ENDPOINTS,
];

/**
 * The bulk endpoints `/api/bulk` can run inside one invocation. Everything not
 * listed here (today only `minor-honour`, which cascades over nested selects)
 * is still fetched on its own.
 *
 * Mirrors `VTOP_PROXY_NAMES` in the API's `src/lib/vtop-proxy.ts`. Keep the two
 * in step: a name here that the API does not know is silently dropped.
 */
const BATCHABLE_BULK_ENDPOINTS: ReadonlySet<string> = new Set([
  "exc-registration",
  "course-completion",
  "credentials",
  "registration-schedule",
  "dayboarder",
  "bank-info",
  "library-due",
  "hostel-counselling",
  "payments",
  "payment-receipts",
  "wallet",
]);

registerOp({
  name: "bulk",
  auth: "vtop",
  meta: {
    label: "Additional records cache",
    description: "Registrations, credentials, library dues and payments cache.",
    category: "profile",
    cost: "heavy",
  },
  async run(ctx, args) {
    const settings = (args?.settings as Record<string, unknown>) || {};
    const bulkEndpoints: string[] = [];
    if (settings.syncAdditionalData !== false) {
      if (settings.syncExcRegistration !== false) bulkEndpoints.push("exc-registration");
      if (settings.syncMinorHonour !== false) bulkEndpoints.push("minor-honour");
      if (settings.syncCourseCompletion !== false) bulkEndpoints.push("course-completion");
    }
    if (settings.syncProfileData !== false) {
      bulkEndpoints.push(
        "credentials",
        "registration-schedule",
        "dayboarder",
        "bank-info",
        "library-due",
        "hostel-counselling",
        "payments",
        "payment-receipts",
        "wallet",
      );
    }
    // Granular subset: custom modes pass `only` to cache some endpoints
    // without the whole sweep. Unknown names are dropped, never fetched.
    const only = args?.only as string[] | undefined;
    const wanted =
      only && only.length > 0
        ? bulkEndpoints.filter((p) => only.includes(p))
        : bulkEndpoints;

    // Split into the endpoints that /api/bulk can run together and the ones that
    // must still be fetched individually.
    const batched: string[] = [];
    const single: string[] = [];
    for (const path of wanted) {
      (BATCHABLE_BULK_ENDPOINTS.has(path) ? batched : single).push(path);
    }

    const results: Record<string, unknown> = {};
    if (batched.length > 0) {
      try {
        const res = await ctx.request(
          "bulk",
          { endpoints: batched },
          { auth: "vtop", retry: { max: 0 } }
        );
        const r = (res as { results?: Record<string, unknown> } | null)?.results;
        if (r) Object.assign(results, r);
      } catch {
        // The batch endpoint is new: if it fails, fall back to fetching each
        // endpoint on its own rather than losing the whole sweep.
        single.push(...batched);
      }
    }

    await Promise.allSettled(
      single.map((path) =>
        ctx
          .request(path, {}, { auth: "vtop", retry: { max: 0 } })
          .then((data: unknown) => {
            results[path] = data;
          })
          .catch(() => {}),
      ),
    );

    for (const [path, data] of Object.entries(results)) {
      if (data && (data as { success?: boolean }).success !== false) {
        storage.cache.set(path, data);
        if (path === "payments") localStorage.setItem("payments_dues", JSON.stringify(data));
        if (path === "payment-receipts") localStorage.setItem("payments_receipts", JSON.stringify(data));
        if (path === "wallet") localStorage.setItem("payments_wallet", JSON.stringify(data));
      }
    }
    return { endpoints: wanted };
  },
});

registerOp({
  name: "lms",
  auth: "vtop",
  meta: {
    label: "Moodle data",
    description: "LMS courses and deadlines. Needs Moodle credentials when passed.",
    category: "academics",
    cost: "heavy",
  },
  async run(ctx, args) {
    try {
      // Callers with explicit Moodle credentials (Dashboard refresh) pass them
      // through; otherwise the server resolves the linked account itself.
      const username = args?.username as string | undefined;
      const pass = (args?.pass ?? args?.password) as string | undefined;
      const body: Record<string, unknown> =
        username && pass ? { username, pass } : {};
      const res = await ctx.request("lms-data", body, { auth: "vtop", retry: { max: 0 } });
      if (Array.isArray(res)) {
        // Preserve per-course `hidden` flags across refreshes.
        try {
          const prev = JSON.parse(localStorage.getItem("moodleData") || "[]");
          const merged = res.map((item: any) => {
            const prevItem = Array.isArray(prev)
              ? prev.find((p: any) => p?.url === item?.url)
              : undefined;
            return { ...item, hidden: prevItem?.hidden ?? false };
          });
          localStorage.setItem("moodleData", JSON.stringify(merged));
          ctx.bridge.setAtom(dataAtoms.moodleDataAtom, merged);
          return merged;
        } catch {
          /* fall through with the raw payload */
        }
      }
      if (res !== null && res !== undefined) ctx.bridge.setAtom(dataAtoms.moodleDataAtom, res);
      return res;
    } catch {
      return null;
    }
  },
});

registerOp({
  name: "circulars",
  auth: "vtop",
  meta: {
    label: "Circulars",
    description: "Official circulars and announcements.",
    category: "campus",
    cost: "light",
  },
  async run(ctx) {
    const res = await ctx.request("circulars", {}, { auth: "vtop", retry: { max: 1 } });
    assertApiSuccess(res, "Circulars");
    try {
      storage.cache.set("circulars", res);
    } catch {}
    return res;
  },
});

registerOp({
  name: "curriculum",
  auth: "vtop",
  meta: {
    label: "Curriculum data",
    description: "Degree credit baskets, catalog and planner source.",
    category: "academics",
    cost: "medium",
  },
  async run(ctx) {
    const res = await ctx.request("curriculum", {}, { auth: "vtop", retry: { max: 1 } });
    assertApiSuccess(res, "Curriculum data");
    if (res && typeof res === "object") {
      try {
        storage.curriculum.set({
          details: (res as any).details,
          categories: (res as any).categories,
          totalCredits: (res as any).totalCredits,
          pageCsrf: (res as any).pageCsrf,
        });
      } catch {}
    }
    return res;
  },
});

/**
 * Social timetable sharing.
 *
 * This op pushes the caller's own derived state and pulls peers plus the grant
 * secrets needed to read them. The server does all the deriving — see
 * docs/social-tt/05-server-derivation.md.
 *
 * It is registered LAST on purpose, and it NEVER throws. Both `Main.tsx`
 * background chains `await` ops sequentially inside a single `try`, so a throw
 * here would skip every op after it (chain 1 still had `buses` and `bulk` to
 * run). A social failure is a red line in the sheet, not a broken sync.
 */
registerOp({
  name: "social",
  auth: "vtop",
  meta: {
    label: "Friends & groups",
    description: "Pushes your timetable, pulls peers and grant secrets.",
    category: "social",
    cost: "medium",
    needsSemester: true,
  },
  async run(ctx, args) {
    // Demo mode hands back authorizedID "DEMO123" and no real session, so the
    // route would 401 and put a bogus failure in the sheet. See
    // credential-manager.ts:71-73.
    const demoMode =
      (args?.demoMode as boolean) ||
      (ctx.ids.VtopUsername as string) === "demo" ||
      (ctx.ids.VtopUsername as string) === "DEMO123";
    if (demoMode) return null;

    // This op used to fire its request with whatever happened to be in the
    // credential manager, which is `null` after a page reload and a live set of
    // cookies well past their useful life after sitting idle. Either way the
    // request went out unauthenticated, the server answered with an error
    // envelope, and `res.identity` was missing — so the op returned `null` and
    // the social page silently showed stale data with no red line. Asking for a
    // session first makes a login explicit, attributed to this op, and costed to
    // one captcha solve.
    try {
      await credentialManager.ensureVtopSession({ demoMode });
    } catch {
      // Handled below: without a session the request cannot succeed, and the
      // guard on `res.identity` keeps the op from writing anything.
    }

    const semesterId =
      (args?.proposedSemesterId as string) ||
      (args?.semesterId as string) ||
      (args?.activeSem as string) ||
      "";

    try {
      const res = (await ctx.request(
        "social/identity/sync",
        semesterId ? { proposedSemesterId: semesterId } : {},
        { auth: "vtop", retry: { max: 1 } }
      )) as SocialSyncPayload | null;

      if (!res || res.success === false || !res.identity) {
        // Previously this returned `null` with nothing recorded, so an
        // unauthenticated or rejected request left the social page showing
        // stale data with no red line and no way to tell it apart from "nothing
        // changed". Surface it as a real failure instead.
        throw toEngineError(
          (res as { message?: string } | null)?.message ||
            "Social sync did not return an identity — the VTOP session may have expired."
        );
      }

      // The term changed, so every cached peer busy map is from a different
      // schedule. Drop them before writing the new identity.
      if (res.identity.semesterId && cachedSemester && res.identity.semesterId !== cachedSemester) {
        clearPeerTimetables();
      }
      cachedSemester = res.identity.semesterId ?? cachedSemester;

      writeIdentity(res.identity);
      // The peer list is cached too. It used to exist only inside
      // `socialPeersAtom`, which nothing but this op writes, so a reload started
      // with an empty list even though every per-handle timetable was still on
      // disk — the Pairs subpage showed the tokens while the friend data stayed
      // blank, and only a resync fixed it.
      writePeers(res.peers ?? []);
      writeOwnTimetable({
        busyMap: res.busyMap ?? {},
        courses: res.courses ?? [],
      });
      // The server is authoritative about which pairings exist, so this is a
      // full replace — a locally-orphaned secret would otherwise linger and
      // keep being sent on reads that 403.
      writeGrants(res.grantSecrets ?? []);

      ctx.bridge.setAtom(socialIdentityAtom, res.identity);
      ctx.bridge.setAtom(socialPeersAtom, res.peers ?? []);
      ctx.bridge.setAtom(socialGrantsAtom, res.grantSecrets ?? []);
      ctx.bridge.setAtom(socialOwnBusyMapAtom, res.busyMap ?? {});
      ctx.bridge.setAtom(socialOwnCoursesAtom, res.courses ?? []);
      ctx.bridge.setAtom(socialSyncStateAtom, {
        version: res.version ?? 0,
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
        syncing: false,
      });

      return res;
    } catch (e) {
      // Deliberately swallowed. Keep the cached copy: a stale peer list beats an
      // empty one, and a failed social push must not read as "you have no
      // friends".
      ctx.bridge.setAtom(socialSyncStateAtom, {
        version: 0,
        lastSyncedAt: null,
        lastError: e instanceof Error ? e.message : String(e),
        syncing: false,
      });
      return null;
    }
  },
});
