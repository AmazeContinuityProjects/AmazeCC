"use client";

import { useCallback } from "react";
import config from "../../../../config.json";
import { syncEngine, api, clearEventHubSession, eventHubRequest } from "@/lib/sync-engine";
import { storage } from "@/lib/storage";
import { syncMarksDiff } from "@/lib/marksSync";
import { syncPastSemesters } from "@/lib/pastDataSync";
import { loadActivityTree, saveActivityTree } from "@/lib/activity-tree";
import { reportError } from "@/lib/error-utils";
import { DEMO_OFFICIAL_OD } from "@/lib/officialOd";
import { BUILT_IN_MODES, resolveMode, type SyncMode } from "@/lib/sync-engine/sync-modes";
import {
  openSyncSession,
  appendSyncLine,
  setSyncProgress,
  closeSyncSession,
  bumpSyncProgress,
} from "@/lib/sync-engine/sync-session";
import type { Ids } from "@/lib/sync-engine/types";

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
          const updated = {
            ...settings,
            isDayscholarWithBus: true,
            residentialStatus: "dayscholar",
          };
          localStorage.setItem("settings", JSON.stringify(updated));
        }
      }

      // Logged automatically via the engine op feed.
    } catch (err) {
      console.error("Failed to fetch transport data:", err);
    }
  }, [settings]);

  // --- Event Handlers ---
  // `modeId` selects a sync mode (built-in or custom). Defaults to the user's
  // preferred mode in settings. Quick runs attendance only; balanced/full run
  // the classic sweep (full awaits the background tail); anything else runs
  // generically through the engine so custom modes stay in one code path.
  const handleReloadRequest = useCallback(
    async (targetSemesterID?: string, modeId?: string) => {
      const activeSem =
        targetSemesterID || settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2];
      if (targetSemesterID && targetSemesterID !== settings.currSemesterID) {
        setSettings((prev) => {
          const next = { ...prev, currSemesterID: targetSemesterID };
          localStorage.setItem("settings", JSON.stringify(next));
          return next;
        });
      }
      const mode = resolveMode(modeId ?? settings.defaultSyncMode ?? "quick", customModes) ?? BUILT_IN_MODES[1];

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

        const { cookies, authorizedID, csrf } = await syncEngine.login(IDs, demoMode);

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

        // Quick Sync: attendance + marks only, nothing else.
        if (mode.id === "quick") {
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

        // Focused built-ins (academics, campus) and all custom modes run
        // generically: the engine writes atoms + caches per op, and only the
        // attendance-derived UI state needs applying here.
        if (mode.id !== "balanced" && mode.id !== "full") {
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

        // Unified through the engine op so start/done/error emit into the
        // session log (same shape as the raw call, plus retry semantics).
        const attendanceTask = syncEngine
          .sync<any>("attendanceMarks", { semesterId: activeSem })
          .then(({ attRes, marksRes }: any) => {
            setAttendanceAndOD(attRes);
            setMarksData(marksRes as object);
            // Read before write — same reason as the login path.
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
          });

        const tasks: Promise<void>[] = [attendanceTask];

        // Cohort statistics for every enrolled class, current and frozen past terms.
        // Non-fatal by design — same reason as the core bundle below: a failed fetch
        // keeps the last good cache instead of failing the reload.
        //
        // Chained AFTER attendance, not alongside it: the stats read verifies each class
        // against the enrollment `/api/attendance` records, so firing both at once is a
        // read-your-writes race — the check runs before the enrollment lands and comes
        // back empty. (`syncAll` already orders them sequentially; this matches it.)
        tasks.push(
          attendanceTask
            .catch(() => {})
            .then(() => syncEngine.sync<void>("marksStats", {}))
            .catch(() => {
              appendSyncLine("Cohort statistics unavailable, keeping last synced records", "error");
            }),
        );

        // Core bundle: grades / exam schedule / hostel / calendar / all-grades.
        // The exam schedule is only ever fetched as part of this op, so a reload
        // that skips it leaves the schedule widgets on their boot-time cache.
        // Each module settles on its own and writes its own atom + cache, so
        // there is nothing to set here — and a failing module keeps the last
        // good data instead of being overwritten with null.
        const cachedProfile = storage.profile.get() as any;
        tasks.push(
          syncEngine
            .sync<void>("core", {
              semesterId: activeSem,
              calendarType: settings.calendarType,
              isHosteller: cachedProfile?.isHosteller ?? false,
            })
            .catch(() => {
              appendSyncLine("Core data unavailable, keeping last synced records", "error");
            }),
        );

        tasks.push(
          // Same contract as EventHubTab: username/password + session, with
          // expiry retry. A raw `api(..., { auth: "eventhub" })` with no body
          // sends an empty POST and the route 500s.
          eventHubRequest(IDs, "events/profile", {
            username: IDs.VtopUsername,
            password: IDs.VtopPassword,
          })
            .then((data: any) => {
              if (data?.events) {
                setRegisteredEvents(data.events);
                storage.registeredEvents.set(data.events);
                appendSyncLine("Registered events fetched", "success");
              } else {
                appendSyncLine("Registered events unavailable (server error)", "error");
              }
            })
            .catch((err: any) => {
              if (err?.reason === "session_expired" || err?.reason === "invalid_credentials") {
                clearEventHubSession();
              }
              appendSyncLine("Registered events unavailable (server error)", "error");
            }),
        );

        tasks.push(
          api("events")
            .then((events: any) => {
              if (Array.isArray(events) && events.length) {
                setEventHubEvents(events);
                appendSyncLine(`${events.length} EventHub events loaded`, "success");
              } else if ((events as any)?.success === false) {
                appendSyncLine("EventHub events unavailable (server error)", "error");
              }
            })
            .catch(() => {
              appendSyncLine("EventHub events unavailable (server error)", "error");
            }),
        );

        const moodleUsername = IDs.MoodleUsername;
        const moodlePassword = IDs.MoodlePassword;

        tasks.push(fetchTransportData());

        if (moodleUsername && moodlePassword) {
          tasks.push(
            (async () => {
              const moodleData = (await api("lms-data", {
                method: "POST",
                body: { username: moodleUsername, pass: moodlePassword },
              })) as any;
              const prevData = JSON.parse(localStorage.getItem("moodleData") || "[]");

              const merged = moodleData.map((item) => {
                const prevItem = prevData.find((p) => p.url === item.url);
                return {
                  ...item,
                  hidden: prevItem?.hidden ?? false,
                };
              });

              setMoodleData(merged);
              localStorage.setItem("moodleData", JSON.stringify(merged));
              appendSyncLine("Moodle data fetched", "success");
              bumpSyncProgress(20);
            })(),
          );
        }

        await Promise.all(tasks);

        // Primary data is ready — make the app interactive immediately (P2-15).
        // Secondary/cache-only data is fetched in the background so it no longer
        // blocks the reload spinner. The session stays open so these lines land
        // in the visible log instead of nowhere.
        setSyncProgress(100);
        appendSyncLine("Primary data ready", "success");
        setIsLoggedIn(true);
        setIsReloading(false);

        appendSyncLine("Starting background sync…", "info");
        const runBackgroundSync = async () => {
          try {
            // Fresher / EPT data
            const [eptRes, ackRes] = await Promise.all([
              api("ept-schedule", { method: "POST", body: { cookies, authorizedID, csrf } }) as any,
              api("acknowledgement", { method: "POST", body: { cookies, authorizedID, csrf } }) as any,
            ]);
            if (eptRes?.success) {
              localStorage.setItem("cache_ept_schedule", JSON.stringify(eptRes));
              appendSyncLine("Fresher / EPT data fetched", "success");
            } else {
              appendSyncLine("Fresher / EPT data unavailable (server error)", "error");
            }
            if (ackRes?.success) localStorage.setItem("cache_acknowledgement", JSON.stringify(ackRes));

            // Bus routes
            const busesRes = (await api("buses")) as any;
            if (busesRes?.success) {
              localStorage.setItem("cache_buses", JSON.stringify(busesRes.buses));
              appendSyncLine("Bus routes fetched", "success");
            } else {
              appendSyncLine("Bus routes unavailable (server error)", "error");
            }

            // Library data
            const dueData = (await api("library-due", {
              method: "POST",
              body: { cookies, authorizedID, csrf },
            })) as any;
            if (dueData?.success) {
              localStorage.setItem("cache_library_due", JSON.stringify(dueData));
              appendSyncLine("Library data fetched", "success");
            } else {
              appendSyncLine("Library data unavailable (server error)", "error");
            }

            // Official OD records (unified sync engine — atom + local storage,
            // logged automatically via the engine op feed)
            try {
              await syncEngine.sync("officialOd", { semesterId: activeSem });
            } catch {
              console.warn("Official OD sync failed");
            }

            // Degree credit baskets / catalog (FFCS curriculum match). Its own
            // try/catch so a failure cannot skip social or the bulk endpoints.
            try {
              await syncEngine.sync("curriculum");
            } catch {
              console.warn("Curriculum sync failed");
            }

            // Friends & groups. Server-derived: this pushes our own timetable
            // and pulls peers + the grant secrets needed to read them. The op
            // never throws, and it gets its own try/catch so a social failure
            // cannot skip the bulk endpoints below or leave the sheet open.
            try {
              await syncEngine.sync("social", {
                proposedSemesterId: activeSem,
                demoMode,
              });
            } catch {
              console.warn("Social sync failed");
            }

            // All other VTOP-scoped endpoints (cached for GenericApiView)
            const bulkEndpoints = [
              "exc-registration",
              "minor-honour",
              "course-completion",
              "hostel-counselling",
              "credentials",
              "registration-schedule",
              "dayboarder",
              "bank-info",
            ];
            let bulkFailed = 0;
            await Promise.allSettled(
              bulkEndpoints.map((path) =>
                api(path, { method: "POST", body: { cookies, authorizedID, csrf } })
                  .then((data: any) => {
                    if (data && data.success !== false) {
                      localStorage.setItem("cache_" + path, JSON.stringify(data));
                    } else {
                      bulkFailed++;
                    }
                  })
                  .catch(() => {
                    bulkFailed++;
                  }),
              ),
            );
            if (bulkFailed > 0) {
              appendSyncLine(
                `${bulkFailed} background record${bulkFailed === 1 ? "" : "s"} failed to cache (server error)`,
                "error",
              );
            } else {
              appendSyncLine("All tab data cached", "success");
            }
            closeSyncSession();
          } catch (bgErr) {
            console.warn("Background data sync failed:", bgErr);
            appendSyncLine("Background sync had errors, continuing", "error");
            closeSyncSession();
          }
        };
        // Full Sync awaits the background tail so progress is honest; every
        // other mode parks it in the background behind the open sheet.
        if (mode.id === "full") {
          await runBackgroundSync();
        } else {
          void runBackgroundSync();
        }
      } catch (err) {
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
