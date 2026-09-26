import { storage } from "../storage";
import { credentialManager } from "./credential-manager";
import { registerOp, type OpCtx } from "./operation-registry";
import { dataAtoms } from "./state-bridge";
import { toEngineError, assertApiSuccess } from "./errors";

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

// core data: grades / schedule / hostel / calendar / allGrades / profileImages
registerOp({
  name: "core",
  auth: "vtop",
  critical: true,
  async run(ctx, args) {
    const semesterId = args?.semesterId as string;
    const calendarType = (args?.calendarType as string) || "ALL";
    const isHosteller = args?.isHosteller as boolean;
    // Settle independently: one failing module must not take down the whole
    // bundle, and failures already emitted their own child error lines above.
    const [gradesSettled, scheduleSettled, hostelSettled, calendarSettled, allGradesSettled, profileImagesSettled] =
      await Promise.allSettled([
        trackedRequest(ctx, "grades", () =>
          ctx
            .request("grades", { semesterId }, { auth: "vtop" })
            .then((r: any) => (assertApiSuccess(r, "Grades"), r)),
        ),
        trackedRequest(ctx, "schedule", () =>
          ctx
            .request("schedule", { semesterId }, { auth: "vtop" })
            .then((r: any) => (assertApiSuccess(r, "Exam schedule"), r)),
        ),
        isHosteller
          ? trackedRequest(ctx, "hostel", () => ctx.request("hostel", {}, { auth: "vtop" }))
          : Promise.resolve({}),
        trackedRequest(ctx, "calendar", () =>
          ctx
            .request("calendar", { type: calendarType, semesterId }, { auth: "vtop" })
            .then((r: any) => (assertApiSuccess(r, "Academic calendar"), r)),
        ),
        trackedRequest(ctx, "all-grades", () =>
          ctx
            .request("all-grades", {}, { auth: "vtop" })
            .then((r: any) => (assertApiSuccess(r, "All grades history"), r)),
        ),
        trackedRequest(ctx, "profile-images", () =>
          ctx
            .request("profile-images", {}, { auth: "vtop", retry: { max: 0 } })
            .then(async (r: any) => (r?.success ? r : null))
            .catch(() => null),
        ),
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
  async run(ctx) {
    try {
      const data = await ctx.request("student", {}, { auth: "vtop", retry: { max: 0 } });
      if (data?.profile) {
        persist("profile", data.profile);
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
  async run(ctx) {
    try {
      const [eptRes, ackRes] = await Promise.all([
        ctx.request("ept-schedule", {}, { auth: "vtop", retry: { max: 0 } }),
        ctx.request("acknowledgement", {}, { auth: "vtop", retry: { max: 0 } }),
      ]);
      if (eptRes?.success) storage.cache.set("ept_schedule", eptRes);
      if (ackRes?.success) storage.cache.set("acknowledgement", ackRes);
    } catch {
      /* fail silently */
    }
  },
});

registerOp({
  name: "buses",
  auth: "none",
  async run(ctx) {
    try {
      const data = await ctx.request("buses", undefined, { method: "GET", auth: "none", retry: { max: 1 } });
      if (data?.success) storage.cache.set("buses", data.buses);
    } catch {
      /* fail silently */
    }
  },
});

registerOp({
  name: "transport",
  auth: "vtop",
  async run(ctx) {
    const data = await ctx.request("transport", {}, { auth: "vtop" });
    persist("transportData", data);
    return data;
  },
});

registerOp({
  name: "events",
  auth: "eventhub",
  async run(ctx, args) {
    const ids = ctx.ids;
    const demoMode = args?.demoMode as boolean;
    try {
      const jsessionid = await credentialManager.loginEventHub(ids, { demoMode });
      const [eventsRes, publicEvents] = await Promise.all([
        (async () => {
          if (!jsessionid) return { events: [] };
          const r = await ctx.request("events/profile", { jsessionid }, { auth: "none", retry: { max: 0 } });
          return r;
        })(),
        ctx.request("events", undefined, { method: "GET", auth: "none", retry: { max: 0 } }).catch(() => []),
      ]);
      if (eventsRes?.events) persist("registeredEvents", eventsRes.events);
      ctx.bridge.setAtom(dataAtoms.registeredEventsAtom, eventsRes?.events || []);
      ctx.bridge.setAtom(dataAtoms.eventHubEventsAtom, publicEvents || []);
      return { registeredEvents: eventsRes?.events || [], eventHubEvents: publicEvents || [] };
    } catch {
      return { registeredEvents: [], eventHubEvents: [] };
    }
  },
});

registerOp({
  name: "bulk",
  auth: "vtop",
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
    await Promise.allSettled(
      bulkEndpoints.map((path) =>
        ctx
          .request(path, {}, { auth: "vtop", retry: { max: 0 } })
          .then((data: any) => {
            if (data?.success !== false) {
              storage.cache.set(path, data);
              if (path === "payments") localStorage.setItem("payments_dues", JSON.stringify(data));
              if (path === "payment-receipts") localStorage.setItem("payments_receipts", JSON.stringify(data));
              if (path === "wallet") localStorage.setItem("payments_wallet", JSON.stringify(data));
            }
          })
          .catch(() => {}),
      ),
    );
  },
});

registerOp({
  name: "lms",
  auth: "vtop",
  async run(ctx) {
    try {
      return await ctx.request("lms-data", {}, { auth: "vtop", retry: { max: 0 } });
    } catch {
      return null;
    }
  },
});
