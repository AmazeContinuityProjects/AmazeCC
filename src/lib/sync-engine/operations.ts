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
      const [eventsRes, publicEvents] = await Promise.all([
        (async () => {
          if (!jsessionid) return { events: [] };
          const r = await ctx.request("events/profile", { jsessionid }, { auth: "none", retry: { max: 0 } });
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
