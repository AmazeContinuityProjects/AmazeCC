"use client";

import { useCallback } from "react";
import config from "../../../../config.json";
import { syncEngine, cancelAllRequests } from "@/lib/sync-engine";
import { storage } from "@/lib/storage";
import { syncMarksDiff } from "@/lib/marksSync";
import { syncPastSemesters } from "@/lib/pastDataSync";
import { loadActivityTree, saveActivityTree } from "@/lib/activity-tree";
import { reportError } from "@/lib/error-utils";
import { DEMO_OFFICIAL_OD } from "@/lib/officialOd";
import { pingVtopDirectly } from "@/lib/vtopHealth";
import { BUILT_IN_MODES, resolveMode, resolveReloadModeId, type SyncMode } from "@/lib/sync-engine/sync-modes";
import { openSyncSession, appendSyncLine, setSyncProgress, closeSyncSession } from "@/lib/sync-engine/sync-session";
import type { Ids } from "@/lib/sync-engine/types";
import { broadcastGlobalSemesterChange, mapToFinalSemesterId } from "@/lib/ffcsReports";
import { broadcastFriendFinderRefresh } from "@/lib/ffcsClassmates";

/** The daily tier — a manual sync always refreshes these, the gate never applies. */
const DAILY_OPS = ["attendanceMarks", "marksStats", "hostel"];

interface AppDataActionOptions {
  IDs: any;
  demoMode: boolean;
  settings: any;
  customModes: SyncMode[];
  setSettings: any;
  setDemoMode: any;
  setIsReloading: any;
  setAttendanceData: any;
  setMarksData: any;
  setGradesData: any;
  setAllGradesData: any;
  setScheduleData: any;
  sethostelData: any;
  setCalender: any;
  setRegisteredEvents: any;
  setEventHubEvents: any;
  setMoodleData: any;
  setIsLoggedIn: any;
  setOfficialOdData: any;
  setAttendanceAndOD: any;
}

export function useAppDataActions({
  IDs,
  demoMode,
  settings,
  customModes,
  setSettings,
  setDemoMode,
  setIsReloading,
  setAttendanceData,
  setMarksData,
  setGradesData,
  setAllGradesData,
  setScheduleData,
  sethostelData,
  setCalender,
  setRegisteredEvents,
  setEventHubEvents,
  setMoodleData,
  setIsLoggedIn,
  setOfficialOdData,
  setAttendanceAndOD,
}: AppDataActionOptions) {
  const loginToVTOP = useCallback(async () => {
    if (demoMode || IDs.VtopUsername === "demo") {
      return { cookies: [], authorizedID: "DEMO123", csrf: "" };
    }
    const isVtopUp = await pingVtopDirectly(4000);
    if (!isVtopUp) {
      cancelAllRequests("VTOP is down");
      throw new Error("VTOP portal unreachable (vtopcc.vit.ac.in is down)");
    }
    // `SyncEngine.login` publishes the authorizedID itself; see the note there.
    return syncEngine.login(IDs, demoMode);
  }, [IDs, demoMode]);

  const handleLogin = useCallback(
    async (currSemesterID = config.semesterIDs[config.semesterIDs.length - 2], loginIds?: Ids) => {
      if (demoMode || IDs.VtopUsername === "demo") {
        const demoData = await (await fetch("/data/demoData.json")).json();
        setDemoMode(true);
        storage.demoMode.set(true);
        setIsReloading(true);
        openSyncSession("Demo environment");

        const stages = [
          { progress: 30, msg: "Demo container ready" },
          { progress: 60, msg: "Mock attendance & marks loaded" },
          { progress: 85, msg: "Mock grades & exam schedule loaded" },
          { progress: 100, msg: "Demo mode ready" },
        ];

        for (let i = 0; i < stages.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          setSyncProgress(stages[i].progress);
          appendSyncLine(stages[i].msg, "success");
        }

        setAttendanceData(demoData.attendance);
        setMarksData(demoData.marks);
        setGradesData(demoData.grades);
        setAllGradesData(demoData.allGrades);
        setScheduleData(demoData.schedule);
        sethostelData(demoData.hostel);
        setCalender(demoData.calender);
        if ((demoData as any).registeredEvents) {
          setRegisteredEvents((demoData as any).registeredEvents);
          localStorage.setItem("registeredEvents", JSON.stringify((demoData as any).registeredEvents));
        }
        if ((demoData as any).profile) {
          localStorage.setItem("profile", JSON.stringify((demoData as any).profile));
        }
        setIsLoggedIn(true);
        setIsReloading(false);
        closeSyncSession();
        return;
      }

      try {
        // Initial login always runs the full sweep: every endpoint is pinged so
        // all caches start warm. Later reloads use the default sync mode
        // (quick out of the box) unless the user picks another.
        openSyncSession("Full Sync");
        appendSyncLine("Checking VTOP portal (vtopcc.vit.ac.in)…", "loading");
        const isVtopUp = await pingVtopDirectly(4000);
        if (!isVtopUp) {
          cancelAllRequests("VTOP is down");
          appendSyncLine("VTOP is down (vtopcc.vit.ac.in unreachable) — sync cancelled", "error");
          setIsReloading(false);
          closeSyncSession(0, "error");
          return false;
        }
        appendSyncLine("Verifying VTOP credentials…", "loading");
        const ids = loginIds ?? IDs;
        await syncEngine.login(ids as Ids, demoMode);
        storage.ids.set(ids as typeof IDs);

        // Engine op start/done/error events feed the session log automatically.
        const { attRes, marksRes } = await syncEngine.sync<any>("attendanceMarks", { semesterId: currSemesterID });

        setAttendanceAndOD(attRes);
        setMarksData(marksRes as object);

        // Read the previous marks BEFORE overwriting the cache. Doing it after meant
        // `oldMarks` was the payload we had just written, so the diff was always empty and
        // a mark change reached the class statistics only if the user happened to hit the
        // reload path instead of logging in.
        const oldMarks = storage.marks.get() || {};

        storage.attendance.set(attRes);
        storage.marks.set(marksRes);

        syncMarksDiff(oldMarks, marksRes).then((r) => {
          if (r.mismatches.length > 0) {
            appendSyncLine(
              `${r.mismatches.length} cohort receipt(s) changed unexpectedly — server state moved`,
              "error",
            );
          }
        });

        let profileRes = storage.profile.get();
        const fetchedProfile = await syncEngine.sync<any>("studentProfile");
        if (fetchedProfile) {
          profileRes = fetchedProfile;
        }

        const isHosteller = (profileRes as any)?.isHosteller ?? false;

        const coreData = await syncEngine.sync<any>("core", {
          semesterId: currSemesterID,
          calendarType: settings.calendarType,
          isHosteller,
        });

        setGradesData(coreData.gradesRes);
        setAllGradesData(coreData.allGradesRes);
        setScheduleData(coreData.scheduleRes);
        sethostelData(coreData.hostelRes);
        setCalender(coreData.calendarRes);

        appendSyncLine("Core data loaded successfully", "success");
        setIsLoggedIn(true);
        setIsReloading(false);

        const tree = loadActivityTree();
        tree.increment();
        saveActivityTree(tree);

        // Defer non-critical/secondary data fetches to the background — kept in
        // the same session so their results stay visible instead of logging
        // nowhere. The sheet closes once they finish. Together with the
        // foreground (attendanceMarks, studentProfile, core) this is the full
        // sweep: every module is pinged on initial login.
        appendSyncLine("Starting background sync…", "info");
        (async () => {
          try {
            console.log("Starting background sync for non-critical data...");

            // Cohort stats read the enrollment the foreground attendance just
            // recorded, so they run first here — same ordering as the sweeps.
            await syncEngine.sync("marksStats", {}).catch(() => {
              appendSyncLine("Cohort statistics unavailable, keeping last synced records", "error");
            });
            await syncEngine.sync("events", { demoMode });
            await syncEngine.sync("officialOd", { semesterId: currSemesterID });
            await syncEngine.sync("pastAttendance", {
              semesterId: currSemesterID,
              allGradesRes: storage.allGrades.get(),
            });
            // Degree credit baskets / catalog — the FFCS planner's My Curriculum
            // match reads this cache. Non-critical: a failure keeps the last
            // good payload and must not skip the ops below it.
            await syncEngine.sync("curriculum").catch(() => {
              appendSyncLine("Curriculum unavailable, keeping last synced records", "error");
            });
            await syncEngine.sync("fresher");
            await syncEngine.sync("buses");
            await syncEngine.sync("transport").catch(() => {});
            await syncEngine.sync("lms", {
              username: (ids as Ids).MoodleUsername as string | undefined,
              pass: (ids as Ids).MoodlePassword as string | undefined,
            });
            // The op itself never throws, so it cannot skip the ops below it.
            await syncEngine.sync("social", {
              proposedSemesterId: currSemesterID,
              demoMode,
            });
            await syncEngine.sync("bulk", { settings });

            console.log("Background sync completed successfully!");
            appendSyncLine("Background sync completed", "success");
            closeSyncSession();
          } catch (bgErr) {
            console.warn("Background sync failed:", bgErr);
            appendSyncLine("Background sync had errors, continuing", "error");
            closeSyncSession();
          }
        })();

        return true;
      } catch (err) {
        const isAbort =
          err instanceof Error && (err.name === "AbortError" || /aborted without reason|aborted/i.test(err.message));
        const isTimeout = err instanceof Error && (err.name === "TimeoutError" || /timed out/i.test(err.message));
        if (isAbort) {
          // User navigated away / request was cancelled — not a real login failure.
          appendSyncLine("Login was cancelled, please try again", "error");
          setSyncProgress(0);
          setIsReloading(false);
          closeSyncSession(4000, "error");
          throw err;
        }
        if (isTimeout) {
          reportError(err, { context: "handleLogin", level: "warn" });
          appendSyncLine("Login timed out (server took too long), check your connection and try again", "error");
        } else {
          reportError(err, { context: "handleLogin" });
          appendSyncLine(err instanceof Error ? err.message : "Login failed", "error");
        }
        setSyncProgress(0);
        setIsReloading(false);
        closeSyncSession(4000, "error");
        // The credential editor is not opened from here. Rejected credentials
        // (`"Invalid Username / Password"`) never matched that old regex, and
        // for the messages that did, the sheet now carries the explanation and
        // the "Change Password" button — popping a second sheet over the top
        // would hide the reason the student is being asked to sign in again.
        throw err;
      }
    },
    [IDs, demoMode, settings, setAttendanceAndOD],
  );

  const fetchTransportData = useCallback(async () => {
    try {
      await syncEngine.sync("transport");
      const result = storage.transportData.get() as any;

      if (result?.success && result?.hasRegistration === true) {
        if (true !== settings.isDayscholarWithBus) {
          setSettings((prev) => ({
            ...prev,
            isDayscholarWithBus: true,
            residentialStatus: "dayscholar",
          }));
        }
      }

      // Logged automatically via the engine op feed.
    } catch (err) {
      console.error("Failed to fetch transport data:", err);
    }
  }, [settings]);

  // --- Event Handlers ---
  // `modeId` selects a sync mode (built-in or custom). An explicit pick runs
  // the whole tier, now — the cadence gate is for unattended/default reloads.
  // A semester switch always forces the full (quarterly) sweep: every cache
  // (attendance, marks, grades) is keyed to the term just left, so a shallow
  // pass would leave the app half-old-term. With no `modeId` and no switch,
  // the user's preferred mode runs, but only its stale steps — the daily tier
  // is forced so a manual tap always refreshes attendance/marks.
  const handleReloadRequest = useCallback(
    async (targetSemesterID?: string, modeId?: string) => {
      const activeSem =
        targetSemesterID || settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2];
      const switchedSemester = !!targetSemesterID && targetSemesterID !== settings.currSemesterID;
      if (switchedSemester) {
        setSettings((prev) => {
          const next = { ...prev, currSemesterID: targetSemesterID };
          return next;
        });
        const mapped = mapToFinalSemesterId(targetSemesterID);
        if (mapped) {
          broadcastGlobalSemesterChange(mapped);
        }
      }
      const mode =
        resolveMode(
          resolveReloadModeId({
            switchedSemester,
            modeId,
            defaultSyncMode: settings.defaultSyncMode,
          }),
          customModes,
        ) ?? BUILT_IN_MODES.find((m) => m.id === "quarterly")!;

      if (demoMode) {
        const demoData = await (await fetch("/data/demoData.json")).json();
        setIsReloading(true);
        openSyncSession("Demo environment");

        const stages = [
          { progress: 40, msg: "Refreshed mock attendance" },
          { progress: 70, msg: "Refreshed mock grades" },
          { progress: 100, msg: "Demo refresh complete" },
        ];

        for (let i = 0; i < stages.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          setSyncProgress(stages[i].progress);
          appendSyncLine(stages[i].msg, "success");
        }

        setAttendanceData(demoData.attendance);
        setMarksData(demoData.marks);
        setGradesData(demoData.grades);
        setAllGradesData(demoData.allGrades);
        setScheduleData(demoData.schedule);
        sethostelData(demoData.hostel);
        setCalender(demoData.calender);
        if ((demoData as any).registeredEvents) {
          setRegisteredEvents((demoData as any).registeredEvents);
          localStorage.setItem("registeredEvents", JSON.stringify((demoData as any).registeredEvents));
        }
        if ((demoData as any).profile) {
          localStorage.setItem("profile", JSON.stringify((demoData as any).profile));
        }
        setOfficialOdData(DEMO_OFFICIAL_OD);
        try {
          const demoSem = settings.currSemesterID || "DEMO";
          storage.officialOd.set(demoSem, { ...DEMO_OFFICIAL_OD, semesterId: demoSem });
        } catch {}
        setIsReloading(false);
        closeSyncSession();
        return;
      }

      setIsReloading(true);
      openSyncSession(mode.label);
      localStorage.setItem("IDs", JSON.stringify(IDs));

      // Pre-flight check: verify VTOP portal is up before dispatching requests to AmazeCC API
      appendSyncLine("Checking VTOP portal (vtopcc.vit.ac.in)…", "loading");
      const isVtopUp = await pingVtopDirectly(4000);
      if (!isVtopUp) {
        cancelAllRequests("VTOP is down");
        appendSyncLine("VTOP is down (vtopcc.vit.ac.in unreachable) — sync cancelled", "error");
        setIsReloading(false);
        closeSyncSession(0, "error");
        return;
      }

      try {
        if ((settings as any).reloadAllData) {
          await handleLogin(activeSem);
          await fetchTransportData();

          try {
            const { cookies, authorizedID, csrf } = await syncEngine.login(IDs, demoMode);
            const allGradesData = JSON.parse(localStorage.getItem("allGrades") || "{}");
            await syncPastSemesters(allGradesData, { cookies, authorizedID, csrf });
          } catch (err) {
            console.error("Failed to sync past semesters on global reload", err);
          }

          closeSyncSession();
          return;
        }

        await syncEngine.login(IDs, demoMode);

        // The FFCS pickers match catalogue codes against the student's
        // curriculum, so fetch it at least once even when the chosen mode
        // skips the op (quick sync and most custom modes do). Only when it
        // is missing — a mode that already syncs it pays nothing here, and
        // a failure is the same honest "no curriculum" state as before.
        if (!storage.curriculum.get()) {
          try {
            await syncEngine.sync("curriculum");
            appendSyncLine("Curriculum fetched for the FFCS pickers", "success");
          } catch {
            console.warn("Curriculum ensure-once sync failed");
          }
        }

        // Shared post-processing for engine attendance results: derived
        // percentages/OD lists plus the cohort-drift log lines. The balanced
        // path below has its own inline copy; these branches reuse this one.
        const applyAttendanceResult = (attRes: any, marksRes: any) => {
          setAttendanceAndOD(attRes);
          setMarksData(marksRes as object);
          const oldMarks = JSON.parse(localStorage.getItem("marks") || "{}");
          syncMarksDiff(oldMarks, marksRes).then((r) => {
            if (r.mismatches.length > 0) {
              appendSyncLine(
                `${r.mismatches.length} cohort receipt(s) changed unexpectedly — server state moved`,
                "error",
              );
            }
            if (r.frozen.length > 0) {
              appendSyncLine(`${r.frozen.length} contribution(s) pinned to an older sync (no local history)`, "info");
            }
          });
          localStorage.setItem("attendance", JSON.stringify(attRes));
          localStorage.setItem("marks", JSON.stringify(marksRes));
        };

        // Daily Sync: attendance + marks only, nothing else.
        if (mode.id === "daily") {
          try {
            const { attRes, marksRes } = await syncEngine.sync<any>("attendanceMarks", {
              semesterId: activeSem,
            });
            applyAttendanceResult(attRes, marksRes);
            await syncEngine.sync<void>("marksStats", {}).catch(() => {
              appendSyncLine("Cohort statistics unavailable, keeping last synced records", "error");
            });
            setSyncProgress(100);
            setIsLoggedIn(true);
            setIsReloading(false);
            // Quick-sync friend finder refresh (decision D5)
            broadcastFriendFinderRefresh();
            closeSyncSession();
          } catch (err) {
            console.error(err);
            appendSyncLine(err instanceof Error ? err.message : "Quick sync failed", "error");
            setSyncProgress(0);
            setIsReloading(false);
            closeSyncSession(4000, "error");
          }
          return;
        }

        // Weekly / Monthly / Quarterly and every custom mode run through the
        // engine; the cadence gate in its runner decides which ops are due.
        // Attendance-derived UI state gets applied here; everything else is
        // written by the ops themselves (atoms + caches).
        // An explicit pick (palette / sync screen) or a semester switch means
        // the user wants exactly that sync, now — bypass the cadence gate
        // entirely. Unattended/default reloads only force the daily tier;
        // the deeper tiers wait for their cadence.
        const explicitPick = modeId != null || switchedSemester;
        {
          try {
            // setAttendanceAndOD diffs against the stored copy, so snapshot it
            // before the engine overwrites it below.
            const prevAttRaw = localStorage.getItem("attendance");
            const cachedProfile = storage.profile.get() as any;
            const res = await syncEngine.syncMode(mode.id, {
              semesterId: activeSem,
              calendarType: settings.calendarType,
              isHosteller: cachedProfile?.isHosteller ?? false,
              settings: settings as unknown as Record<string, unknown>,
              demoMode,
              // Explicit pick → whole tier runs now (and is awaited, like the
              // quarterly sweep); default reload → daily tier forced, deeper gated.
              ...(explicitPick ? { force: true, awaitBackground: true } : { forceOps: DAILY_OPS }),
            });
            const att = res.results.find((r) => r.op === "attendanceMarks")?.value as any;
            if (att?.attRes) {
              if (prevAttRaw) localStorage.setItem("attendance", prevAttRaw);
              applyAttendanceResult(att.attRes, att.marksRes);
            }
            setSyncProgress(100);
            setIsLoggedIn(true);
            setIsReloading(false);
            if (res.errors.length > 0) {
              appendSyncLine(
                `${res.errors.length} module${res.errors.length === 1 ? "" : "s"} had errors — kept last good data`,
                "error",
              );
            } else {
              appendSyncLine(`${mode.label} complete`, "success");
            }
            // Quick-sync friend finder refresh (decision D5)
            broadcastFriendFinderRefresh();
            closeSyncSession();
          } catch (err) {
            console.error(err);
            appendSyncLine(err instanceof Error ? err.message : "Login failed", "error");
            setSyncProgress(0);
            setIsReloading(false);
            closeSyncSession(4000, "error");
          }
          return;
        }
      } catch (err: any) {
        if (err?.name === "AbortError" || /aborted/i.test(err?.message)) {
          setIsReloading(false);
          return;
        }
        console.error(err);
        appendSyncLine(err instanceof Error ? err.message : "Login failed", "error");
        setSyncProgress(0);
        setIsReloading(false);
        closeSyncSession(4000, "error");
      }
    },
    [settings, config, demoMode, IDs, loginToVTOP, fetchTransportData, setAttendanceAndOD, handleLogin, customModes],
  );

  return { loginToVTOP, handleLogin, handleReloadRequest };
}
