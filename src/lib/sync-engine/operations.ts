import { storage } from "../storage";
import { credentialManager } from "./credential-manager";
import { registerOp, type OpCtx } from "./operation-registry";
import { dataAtoms } from "./state-bridge";
import { toEngineError, assertApiSuccess } from "./errors";
import {
  clearPeerTimetables,
  readIdentity,
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
  type SocialSyncState,
} from "../../store/socialAtoms";

/**
 * The term the last successful social sync wrote. Module-level because the
 * cache is global to the app, and comparing against the freshly-derived
 * identity is how we notice the user switched semesters.
 */
let cachedSemester: string | null = null;

export const WHOAMI_CACHE_KEY = "whoami";

function whoamiToProfile(data: any): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const profile: Record<string, unknown> = {};
  const map: Record<string, string> = {
    regNo: "regNo",
    name: "name",
    email: "email",
    mobile: "mobile",
    dob: "dob",
    gender: "gender",
    bloodGroup: "bloodGroup",
    photoBase64: "photoBase64",
    program: "program",
    nationality: "nationality",
    nativeLanguage: "nativeLanguage",
    nativeState: "nativeState",
    community: "community",
    religion: "religion",
    caste: "caste",
    physicallyChallenged: "physicallyChallenged",
    aadharNumber: "aadharNumber",
    currentAddress: "currentAddress",
    permanentAddress: "permanentAddress",
    father: "father",
    mother: "mother",
    guardian: "guardian",
    proctor: "proctor",
    hodDean: "hodDean",
    credentials: "credentials",
    ranks: "ranks",
    apaar: "apaar",
    bank: "bank",
    contact: "contact",
  };
  for (const [k, out] of Object.entries(map)) {
    if (data[k] !== undefined) profile[out] = data[k];
  }
  if (typeof data.isHosteller === "boolean") profile.isHosteller = data.isHosteller;
  return Object.keys(profile).length ? profile : null;
}

async function fetchWhoami(ctx: OpCtx): Promise<any> {
  const data = await ctx.request("whoami", {}, { auth: "vtop", retry: { max: 1 } });
  if (!data || data.success === false) {
    throw new Error((data && (data.error || data.message)) || "Failed to fetch whoami");
  }
  storage.cache.set(WHOAMI_CACHE_KEY, data);
  const profile = whoamiToProfile(data);
  if (profile) {
    persist("profile", profile);
    ctx.bridge.setAtom(activeRegNumberAtom, getActiveRegNumber());
  }
  return data;
}

/**
 * Run one request with its own start/done/error emits so the sync log shows
 * per-module results instead of a single opaque parent-op line.
 */
async function trackedRequest<T>(ctx: OpCtx, opName: string, request: () => Promise<T>): Promise<T> {
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

// --- Adapters for unified endpoints ----------------------------------------

/**
 * Unified /api/grades returns a single shape:
 * { success, overall: { cgpa, curriculum }, semesters: { [id]: { gpa, grades:[{..., effective?:{...}}] } } }
 * Effective grade info is merged into semester courses. Feedback is served by /api/ffcs.
 * Adapt into legacy client shapes so existing UI/state consumers keep working.
 */
export function adaptUnifiedGradesResponse(res: any): {
  gradesSummary: any;
  allGrades: { grades: Record<string, unknown> };
} {
  if (!res || typeof res !== "object") {
    return { gradesSummary: res, allGrades: { grades: {} } };
  }

  const semesters =
    (res.semesters && typeof res.semesters === "object" ? res.semesters : null) ||
    (res.history && typeof res.history === "object" ? res.history : null) ||
    (res.grades && typeof res.grades === "object" ? res.grades : null) ||
    {};

  const overall = res.overall && typeof res.overall === "object" ? res.overall : res;

  // Reconstruct legacy effectiveGrades array for compatibility (gradesEffective.ts, UI)
  const effectiveGrades: any[] = [];
  if (Array.isArray(overall.effectiveGrades)) {
    effectiveGrades.push(...overall.effectiveGrades);
  } else {
    const seen = new Set<string>();
    for (const semId of Object.keys(semesters as Record<string, any>)) {
      const sem = (semesters as any)[semId];
      if (!sem || !Array.isArray(sem.grades)) continue;
      for (const course of sem.grades) {
        // New flattened shape: effective-only fields live on the course (no duplicate code/title/grade)
        const hasEffectiveInfo =
          course?.distributionType ||
          course?.creditsEarned ||
          course?.examMonth ||
          course?.resultDeclared ||
          course?.effectiveCourseType ||
          course?.effective;
        if (!hasEffectiveInfo) continue;
        const eff = course?.effective || {};
        const courseCode = String(eff.courseCode || course.courseCode || "").trim();
        const grade = String(eff.grade || course.grade || "").trim();
        const creditsEarned = String(eff.creditsEarned || course.creditsEarned || "");
        const key = `${courseCode.toUpperCase()}|${grade.toUpperCase()}|${creditsEarned}`;
        if (seen.has(key)) continue;
        seen.add(key);
        effectiveGrades.push({
          basketTitle: eff.courseTitle || course.courseTitle || eff.basketTitle || "",
          courseType: eff.courseType || course.effectiveCourseType || course.courseType || "",
          creditsEarned,
          grade,
          distributionType: eff.distributionType || course.distributionType || "",
          courseCode,
          examMonth: eff.examMonth || course.examMonth || "",
          resultDeclared: eff.resultDeclared || course.resultDeclared || "",
        });
      }
    }
  }

  const gradesSummary = {
    effectiveGrades,
    curriculum: Array.isArray(overall.curriculum) ? overall.curriculum : (overall.curriculum ?? []),
    cgpa: overall.cgpa ?? {},
    ...(res.success !== undefined ? { success: res.success } : {}),
  };

  return {
    gradesSummary,
    allGrades: { grades: semesters as Record<string, unknown> },
  };
}

function extractRegistrationSchedule(ffcsRes: any): any {
  if (!ffcsRes || typeof ffcsRes !== "object") return ffcsRes;
  if (ffcsRes.registrationSchedule !== undefined) return ffcsRes.registrationSchedule;
  // allow passing through if already a schedule-shaped response
  return ffcsRes;
}

function extractExamSchedule(ffcsRes: any): any {
  if (!ffcsRes || typeof ffcsRes !== "object") return ffcsRes;
  const schedule = ffcsRes.schedule !== undefined ? ffcsRes.schedule : ffcsRes;
  if (schedule && typeof schedule === "object" && !("success" in schedule) && ffcsRes?.success !== undefined) {
    return { ...schedule, success: ffcsRes.success };
  }
  return schedule;
}

function extractWishlist(ffcsRes: any): any {
  if (!ffcsRes || typeof ffcsRes !== "object") return ffcsRes;
  return ffcsRes.wishlist !== undefined ? ffcsRes.wishlist : ffcsRes;
}

function extractSimpleFeedback(ffcsRes: any): any {
  if (!ffcsRes || typeof ffcsRes !== "object") return null;
  return ffcsRes.feedback ?? null;
}

function extractDetailedFeedbackStatus(ffcsRes: any): any {
  if (!ffcsRes || typeof ffcsRes !== "object") return ffcsRes;
  return ffcsRes.feedbackStatus !== undefined ? ffcsRes.feedbackStatus : ffcsRes;
}

async function fetchFfcsAll(ctx: OpCtx, args: { semesterId?: string; trackAs?: string; label?: string } = {}) {
  const trackAs = args.trackAs || "ffcs";
  const label = args.label || "FFCS";
  return trackedRequest(ctx, trackAs, () =>
    ctx.request("ffcs", args.semesterId ? { semesterId: args.semesterId } : {}, { auth: "vtop" }).then((r: any) => {
      assertApiSuccess(r, label);
      return r;
    }),
  );
}

function distributeFfcsCache(ctx: OpCtx, ffcs: any, semesterId?: string) {
  if (!ffcs || typeof ffcs !== "object") return;
  const reg = extractRegistrationSchedule(ffcs);
  if (reg !== undefined && reg !== null) {
    persist("registration-schedule", reg);
    storage.cache.set("registration_schedule", reg);
  }
  const wishlist = extractWishlist(ffcs);
  if (wishlist !== undefined && wishlist !== null) {
    storage.cache.set("wishlist", wishlist);
  }
  const feedback = extractSimpleFeedback(ffcs);
  if (feedback) {
    try {
      localStorage.setItem("cache_ffcs_feedback", JSON.stringify(feedback));
    } catch {}
  }
  const detailed = extractDetailedFeedbackStatus(ffcs);
  if (detailed !== undefined && detailed !== null) {
    storage.cache.set("ffcs_feedback_status", detailed);
  }
  // exam schedule distribution handled by callers that need atom/persist key semantics
  void semesterId;
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
    const data = await ctx.request("attendance", { semesterId }, { auth: "vtop", retry: { max: 1 } });
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
        const id = c && typeof c === "object" ? (c as { classNbr?: unknown }).classNbr : undefined;
        if (typeof id === "string" && id.length > 0) ids.add(id);
      }
    };

    try {
      const current = storage.marks.get() as { courses?: unknown } | null;
      collect(current?.courses);
    } catch {}

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("frozen_marks_")) continue;
        try {
          const data = JSON.parse(localStorage.getItem(key) || "null") as { courses?: unknown } | null;
          collect(data?.courses);
        } catch {}
      }
    } catch {}

    const classIds = [...ids].slice(0, 100);
    if (classIds.length === 0) return { stats: {} };

    const res = await trackedRequest(ctx, "marksStats", () =>
      ctx
        .request("marks/stats", { classIds }, { auth: "vtop" })
        .then((r: any) => (assertApiSuccess(r, "Cohort statistics"), r)),
    );

    const fresh = (res as { stats?: Record<string, unknown> })?.stats ?? {};
    const prev = (ctx.bridge.getAtom(dataAtoms.marksStatsAtom) as Record<string, unknown>) ?? {};
    const merged = { ...prev, ...fresh };
    persist("marksStats", merged);
    ctx.bridge.setAtom(dataAtoms.marksStatsAtom, merged);
    return { stats: merged };
  },
});

// --- Core bundle children -------------------------------------------------

async function fetchUnifiedGrades(ctx: OpCtx, semesterId: string) {
  return trackedRequest(ctx, "grades", () =>
    ctx.request("grades", { semesterId }, { auth: "vtop" }).then((r: any) => (assertApiSuccess(r, "Grades"), r)),
  );
}

function applyUnifiedGrades(ctx: OpCtx, unified: any): { gradesSummary: any; allGrades: any } {
  if (unified === null || unified === undefined) {
    return { gradesSummary: null, allGrades: null };
  }
  const { gradesSummary, allGrades } = adaptUnifiedGradesResponse(unified);
  persist("grades", gradesSummary);
  persist("allGrades", allGrades);
  ctx.bridge.setAtom(dataAtoms.gradesDataAtom, gradesSummary);
  ctx.bridge.setAtom(dataAtoms.allGradesDataAtom, allGrades);
  return { gradesSummary, allGrades };
}

async function fetchSchedule(ctx: OpCtx, semesterId: string) {
  return fetchFfcsAll(ctx, { semesterId, trackAs: "schedule", label: "Exam schedule" }).then((ffcs: any) => {
    distributeFfcsCache(ctx, ffcs, semesterId);
    return extractExamSchedule(ffcs);
  });
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

async function fetchAllGrades(ctx: OpCtx, semesterId?: string) {
  // Unified endpoint: fetching grades returns history too. Reuse it and adapt.
  return trackedRequest(ctx, "all-grades", () =>
    ctx
      .request("grades", { semesterId }, { auth: "vtop" })
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
export const CORE_CHILD_OPS = ["grades", "schedule", "hostel", "calendar", "all-grades", "profile-images"] as const;

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
    description: "Unified grades summary and semester history.",
    category: "academics",
    cost: "heavy",
    needsSemester: true,
  },
  async run(ctx, args) {
    const unified = await fetchUnifiedGrades(ctx, args?.semesterId as string);
    const { gradesSummary } = applyUnifiedGrades(ctx, unified);
    return gradesSummary;
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
    description: "Every semester's grades — adapted from unified grades endpoint.",
    category: "academics",
    cost: "heavy",
  },
  async run(ctx, args) {
    const unified = await fetchAllGrades(ctx, args?.semesterId as string);
    const { allGrades } = applyUnifiedGrades(ctx, unified);
    return allGrades;
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

// core data: unified grades (summary+history) / schedule / hostel / calendar / profileImages
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
    const only = args?.only as string[] | undefined;
    const wanted = new Set<CoreChildOp>(
      only && only.length > 0
        ? (only.filter((n) => (CORE_CHILD_OPS as readonly string[]).includes(n)) as CoreChildOp[])
        : [...CORE_CHILD_OPS],
    );

    const wantUnifiedGrades = wanted.has("grades") || wanted.has("all-grades");
    const unifiedGradesPromise = wantUnifiedGrades
      ? fetchUnifiedGrades(ctx, semesterId).catch((e) => {
          // fetchUnifiedGrades already emitted tracked "grades" events; keep failure
          throw e;
        })
      : Promise.resolve(null);

    const runOrSkip = <T>(name: CoreChildOp, fn: () => Promise<T>): Promise<T | null> =>
      wanted.has(name) ? fn() : Promise.resolve(null);

    const ffcsBundlePromise = wanted.has("schedule")
      ? fetchFfcsAll(ctx, { semesterId, trackAs: "schedule", label: "Exam schedule" }).catch((e) => {
          throw e;
        })
      : Promise.resolve(null);

    const [unifiedGradesSettled, ffcsSettled, hostelSettled, calendarSettled, profileImagesSettled] =
      await Promise.allSettled([
        unifiedGradesPromise,
        ffcsBundlePromise,
        wanted.has("hostel") ? (isHosteller ? fetchHostel(ctx) : Promise.resolve({})) : Promise.resolve(null),
        runOrSkip("calendar", () => fetchCalendar(ctx, semesterId, calendarType)),
        runOrSkip("profile-images", () => fetchProfileImages(ctx)),
      ]);

    let gradesRes: any = null;
    let allGradesRes: any = null;
    const unifiedVal = settledValue(unifiedGradesSettled);
    if (unifiedVal !== null && unifiedVal !== undefined) {
      const adapted = applyUnifiedGrades(ctx, unifiedVal);
      gradesRes = wanted.has("grades") ? adapted.gradesSummary : null;
      allGradesRes = wanted.has("all-grades") ? adapted.allGrades : null;
      // if only one was wanted, still keep caches updated above but report requested ones
      if (wanted.has("grades") && wanted.has("all-grades")) {
        gradesRes = adapted.gradesSummary;
        allGradesRes = adapted.allGrades;
      } else if (wanted.has("grades")) {
        gradesRes = adapted.gradesSummary;
      } else if (wanted.has("all-grades")) {
        allGradesRes = adapted.allGrades;
      }
    } else if (wantUnifiedGrades && unifiedGradesSettled.status === "rejected") {
      // emit all-grades error line too if it was requested separately for visibility
      if (wanted.has("all-grades") && !wanted.has("grades")) {
        // fetchUnifiedGrades tracked as "grades"; also surface under all-grades name
        ctx.emit({ op: "all-grades", phase: "error", error: toEngineError(unifiedGradesSettled.reason) });
      } else if (wanted.has("all-grades") && wanted.has("grades")) {
        ctx.emit({ op: "all-grades", phase: "error", error: toEngineError(unifiedGradesSettled.reason) });
      }
    }

    const ffcsVal = settledValue(ffcsSettled);
    if (ffcsVal) distributeFfcsCache(ctx, ffcsVal, semesterId);
    const scheduleRes = wanted.has("schedule") ? extractExamSchedule(ffcsVal) : null;
    const hostelRes = settledValue(hostelSettled);
    const calendarRes = settledValue(calendarSettled);
    const profileImagesRes = settledValue(profileImagesSettled);

    const persistIfPresent = (key: string, value: unknown) => {
      if (value !== null && value !== undefined) persist(key, value);
    };
    persistIfPresent("schedule", scheduleRes);
    persistIfPresent("hostel", hostelRes);
    persistIfPresent("calendar", calendarRes);
    if (profileImagesRes) persist("profileImages", profileImagesRes);

    const setAtomIfPresent = (atom: unknown, value: unknown) => {
      if (value !== null && value !== undefined) ctx.bridge.setAtom(atom, value);
    };
    setAtomIfPresent(dataAtoms.scheduleDataAtom, scheduleRes);
    setAtomIfPresent(dataAtoms.hostelDataAtom, hostelRes);
    setAtomIfPresent(dataAtoms.calendarDataAtom, calendarRes);

    // ensure requested grade outputs reflect state even if fetched via unified call
    if (wantUnifiedGrades && unifiedVal != null) {
      const adapted = adaptUnifiedGradesResponse(unifiedVal);
      gradesRes = wanted.has("grades") ? adapted.gradesSummary : gradesRes;
      allGradesRes = wanted.has("all-grades") ? adapted.allGrades : allGradesRes;
    }

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
      const payload = {
        success: true,
        semesterId,
        totalCount: data?.totalCount ?? 0,
        note: data?.note ?? null,
        records: data?.records ?? [],
      };
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
  name: "whoami",
  auth: "vtop",
  meta: {
    label: "Identity & profile",
    description: "Unified identity/profile/contact/credentials/acknowledgement/dayboarder/EPT data.",
    category: "profile",
    cost: "medium",
  },
  async run(ctx) {
    try {
      return await fetchWhoami(ctx);
    } catch {
      return storage.cache.get(WHOAMI_CACHE_KEY) ?? null;
    }
  },
});

registerOp({
  name: "studentProfile",
  auth: "vtop",
  meta: {
    label: "Profile details",
    description: "Student profile/identity via /api/whoami; publishes the active reg number.",
    category: "profile",
    cost: "medium",
  },
  async run(ctx) {
    try {
      const data = await fetchWhoami(ctx);
      return whoamiToProfile(data);
    } catch {
      const cached = storage.cache.get(WHOAMI_CACHE_KEY) as any;
      return whoamiToProfile(cached);
    }
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
    const allGradesRes =
      (args?.allGradesRes as { grades?: Record<string, unknown> }) || (storage.allGrades.get() as any) || {};
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
    description: "EPT schedule and acknowledgement via /api/whoami.",
    category: "campus",
    cost: "medium",
  },
  async run(ctx) {
    try {
      const data = await fetchWhoami(ctx);
      return { eptSchedule: data?.eptSchedule ?? null, acknowledgement: data?.acknowledgement ?? null };
    } catch {
      const cached = storage.cache.get(WHOAMI_CACHE_KEY) as any;
      return { eptSchedule: cached?.eptSchedule ?? null, acknowledgement: cached?.acknowledgement ?? null };
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
    let session: string;
    try {
      session = await credentialManager.ensureEventHubSession(ids, { demoMode });
    } catch (e) {
      ctx.emit({ op: "events", phase: "error", error: toEngineError(e) });
      return { registeredEvents: [], eventHubEvents: [] };
    }
    try {
      const jsessionid = session;
      const fetchProfile = (sid: string) =>
        ctx.request(
          "events/profile",
          {
            username: ids.VtopUsername,
            password: ids.VtopPassword,
            ...(sid ? { jsessionid: sid } : {}),
          },
          { auth: "none", retry: { max: 0 } },
        );
      const [eventsRes, publicEvents] = await Promise.all([
        (async () => {
          if (!jsessionid && (demoMode || ids.VtopUsername === "demo")) return { events: [] };
          let r: any = await fetchProfile(jsessionid);
          if ((r as { reauthenticate?: boolean } | null)?.reauthenticate) {
            credentialManager.clearEventHub();
            const fresh = await credentialManager.ensureEventHubSession(ids, { demoMode }).catch(() => "");
            r = await fetchProfile(fresh);
          }
          return r;
        })(),
        ctx.request("events", undefined, { method: "GET", auth: "none", retry: { max: 0 } }).catch(() => []),
      ]);
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
export const BULK_ADDITIONAL_ENDPOINTS = ["exc-registration", "minor-honour", "course-completion"] as const;

/** Bulk endpoints gated by `syncProfileData` (profile + payments + library). */
export const BULK_PROFILE_ENDPOINTS = [
  "registration-schedule",
  "library-due",
  "hostel-counselling",
  "payments",
  "payment-receipts",
  "wallet",
] as const;

export const ALL_BULK_ENDPOINTS: readonly string[] = [...BULK_ADDITIONAL_ENDPOINTS, ...BULK_PROFILE_ENDPOINTS];

/**
 * The bulk endpoints `/api/bulk` can run inside one invocation. Everything not
 * listed here (today only `minor-honour`, which cascades over nested selects)
 * is still fetched on its own.
 */
const BATCHABLE_BULK_ENDPOINTS: ReadonlySet<string> = new Set([
  "exc-registration",
  "course-completion",
  "registration-schedule",
  "hostel-counselling",
]);

const FINANCE_ENDPOINTS = new Set(["payments", "payment-receipts", "wallet", "library-due"]);
const FINANCE_SECTION_BY_ENDPOINT: Record<string, string> = {
  payments: "dues",
  "payment-receipts": "receipts",
  wallet: "wallet",
  "library-due": "library",
};

function adaptFinanceResults(financeRes: any, requested: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!financeRes || typeof financeRes !== "object") return out;
  for (const endpoint of requested) {
    if (!FINANCE_ENDPOINTS.has(endpoint)) continue;
    const section = FINANCE_SECTION_BY_ENDPOINT[endpoint];
    const value = (financeRes as any)[section];
    if (value == null) continue;
    if (endpoint === "library-due") out[endpoint] = { success: true, ...(value as Record<string, unknown>) };
    else if (endpoint === "bank-info") out[endpoint] = value;
    else out[endpoint] = value;
  }
  return out;
}

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
        "registration-schedule",
        "library-due",
        "hostel-counselling",
        "payments",
        "payment-receipts",
        "wallet",
      );
    }
    const only = args?.only as string[] | undefined;
    const wanted = only && only.length > 0 ? bulkEndpoints.filter((p) => only.includes(p)) : bulkEndpoints;

    const financeWanted = wanted.filter((p) => FINANCE_ENDPOINTS.has(p));
    const batched: string[] = [];
    const single: string[] = [];
    for (const path of wanted) {
      if (FINANCE_ENDPOINTS.has(path)) continue;
      (BATCHABLE_BULK_ENDPOINTS.has(path) ? batched : single).push(path);
    }

    const results: Record<string, unknown> = {};
    if (financeWanted.length > 0) {
      try {
        const sections = [...new Set(financeWanted.map((p) => FINANCE_SECTION_BY_ENDPOINT[p]).filter(Boolean))];
        const res = await ctx.request(
          "finance",
          sections.length === 1 ? { section: sections[0] } : { section: "all" },
          { auth: "vtop", retry: { max: 0 } },
        );
        Object.assign(results, adaptFinanceResults(res, financeWanted));
      } catch {
        single.push(...financeWanted);
      }
    }

    if (batched.length > 0) {
      try {
        const res = await ctx.request("bulk", { endpoints: batched }, { auth: "vtop", retry: { max: 0 } });
        const r = (res as { results?: Record<string, unknown> } | null)?.results;
        if (r) Object.assign(results, r);
      } catch {
        single.push(...batched);
      }
    }

    await Promise.allSettled(
      single.map((path) => {
        if (path === "registration-schedule") {
          return ctx
            .request("ffcs", {}, { auth: "vtop", retry: { max: 0 } })
            .then((data: unknown) => {
              assertApiSuccess(data, "FFCS");
              distributeFfcsCache(ctx, data);
              results[path] = extractRegistrationSchedule(data);
            })
            .catch(() => {});
        }
        return ctx
          .request(path, {}, { auth: "vtop", retry: { max: 0 } })
          .then((data: unknown) => {
            results[path] = data;
          })
          .catch(() => {});
      }),
    );

    for (const [path, data] of Object.entries(results)) {
      if (data && (data as { success?: boolean }).success !== false) {
        storage.cache.set(path === "registration-schedule" ? "registration-schedule" : path, data);
        if (path === "registration-schedule") {
          storage.cache.set("registration_schedule", data);
        }
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
      const username = args?.username as string | undefined;
      const pass = (args?.pass ?? args?.password) as string | undefined;
      const body: Record<string, unknown> = username && pass ? { username, pass } : {};
      const res = await ctx.request("lms-data", body, { auth: "vtop", retry: { max: 0 } });
      if (Array.isArray(res)) {
        try {
          const prev = JSON.parse(localStorage.getItem("moodleData") || "[]");
          const merged = res.map((item: any) => {
            const prevItem = Array.isArray(prev) ? prev.find((p: any) => p?.url === item?.url) : undefined;
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

registerOp({
  name: "qcm",
  auth: "vtop",
  meta: {
    label: "Quality Circle Meeting (QCM)",
    description: "Course committee feedback, suggestions and faculty remarks.",
    category: "academics",
    cost: "light",
    needsSemester: true,
  },
  async run(ctx, args) {
    const res = await ctx.request(
      "qcm-view",
      { semesterId: args?.semesterId || "" },
      { auth: "vtop", retry: { max: 1 } },
    );
    assertApiSuccess(res, "Quality Circle Meeting (QCM)");
    if (res && typeof res === "object") {
      try {
        const payload = (res as any).data || res;
        storage.qcmData.set(payload);
      } catch {}
    }
    return res;
  },
});

registerOp({
  name: "ffcs",
  auth: "vtop",
  meta: {
    label: "FFCS",
    description: "Registration, feedback, wishlist, exam schedule and QCM in one call.",
    category: "academics",
    cost: "heavy",
    needsSemester: true,
  },
  async run(ctx, args) {
    const semesterId = args?.semesterId as string | undefined;
    const ffcs = await fetchFfcsAll(ctx, { semesterId, trackAs: "ffcs", label: "FFCS" });
    distributeFfcsCache(ctx, ffcs, semesterId);
    const schedule = extractExamSchedule(ffcs);
    if (schedule) {
      persist("schedule", schedule);
      ctx.bridge.setAtom(dataAtoms.scheduleDataAtom, schedule);
    }
    return {
      ...ffcs,
      registrationSchedule: extractRegistrationSchedule(ffcs),
      schedule,
      wishlist: extractWishlist(ffcs),
      feedback: extractSimpleFeedback(ffcs),
      feedbackStatus: extractDetailedFeedbackStatus(ffcs),
    };
  },
});

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
    const demoMode =
      (args?.demoMode as boolean) ||
      (ctx.ids.VtopUsername as string) === "demo" ||
      (ctx.ids.VtopUsername as string) === "DEMO123";
    if (demoMode) return null;

    try {
      await credentialManager.ensureVtopSession({ demoMode });
    } catch {}

    const semesterId =
      (args?.proposedSemesterId as string) || (args?.semesterId as string) || (args?.activeSem as string) || "";

    const prevState = (ctx.bridge.getAtom(socialSyncStateAtom) as SocialSyncState | undefined) ?? {
      version: 0,
      lastSyncedAt: null,
      lastError: null,
      syncing: false,
    };
    ctx.bridge.setAtom(socialSyncStateAtom, { ...prevState, syncing: true });

    try {
      const res = (await ctx.request("social/identity/sync", semesterId ? { proposedSemesterId: semesterId } : {}, {
        auth: "vtop",
        retry: { max: 1 },
      })) as SocialSyncPayload | null;

      if (!res || res.success === false || !res.identity) {
        throw toEngineError(
          (res as { message?: string } | null)?.message ||
            "Social sync did not return an identity — the VTOP session may have expired.",
        );
      }

      const previousSemester = cachedSemester ?? readIdentity<{ semesterId?: string | null }>()?.semesterId ?? null;
      if (res.identity.semesterId && previousSemester && res.identity.semesterId !== previousSemester) {
        clearPeerTimetables();
      }
      cachedSemester = res.identity.semesterId ?? cachedSemester;

      writeIdentity(res.identity);
      writePeers(res.peers ?? []);
      writeOwnTimetable({ busyMap: res.busyMap ?? {}, courses: res.courses ?? [] });
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
      ctx.bridge.setAtom(socialSyncStateAtom, {
        ...prevState,
        lastError: e instanceof Error ? e.message : String(e),
        syncing: false,
      });
      return null;
    }
  },
});

registerOp({
  name: "finance",
  auth: "vtop",
  meta: {
    label: "Finance",
    description: "Payments, dues, receipts, wallet and receipt details.",
    category: "campus",
    cost: "medium",
  },
  async run(ctx, args) {
    const section = (args?.section as string) || "all";
    const applNo = args?.applNo as string | undefined;
    const body: Record<string, unknown> = { section };
    if (applNo) body.applNo = applNo;
    const res = await ctx.request<any>("finance", body, { auth: "vtop" });
    assertApiSuccess(res, "Finance");
    if (section === "all") {
      const dues = res?.dues ?? null;
      const receipts = res?.receipts ?? null;
      const wallet = res?.wallet ?? null;
      const library = res?.library ?? null;
      const bank = res?.bank ?? null;
      try {
        if (dues) localStorage.setItem("uni_cc_payments_dues", JSON.stringify(dues));
        if (receipts) localStorage.setItem("uni_cc_payment_receipts", JSON.stringify(receipts));
        if (wallet) localStorage.setItem("uni_cc_wallet", JSON.stringify(wallet));
        if (library) storage.cache.set("library-due", { success: true, ...library });
        if (bank) storage.cache.set("bank-info", bank);
      } catch {}
    }
    return res;
  },
});

registerOp({
  name: "notifications-subscribe",
  auth: "none",
  meta: {
    label: "Push subscribe",
    description: "Register push notification subscription.",
    category: "other",
    cost: "light",
  },
  async run(ctx, args) {
    return ctx.request<any>("notifications/subscribe", args || {}, { auth: "none" });
  },
});
