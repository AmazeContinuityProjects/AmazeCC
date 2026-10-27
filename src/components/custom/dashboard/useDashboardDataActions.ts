"use client";

import { useCallback, useEffect, useState } from "react";
import { useAtom } from "jotai";
import {
  allGradesDataAtom,
  calendarDataAtom,
  credentialsAtom,
  gradesDataAtom,
  hostelDataAtom,
  isReloadingAtom,
  moodleDataAtom,
  scheduleDataAtom,
  settingsAtom,
} from "@/store";
import { syncEngine } from "@/lib/sync-engine";
import { appendSyncLine } from "@/lib/sync-engine/sync-session";
import { runPageSync } from "@/lib/sync-engine/single-sync";
import { loadFrozenPastSemesters } from "@/lib/pastDataSync";

/** Owns dashboard-triggered academic, calendar, hostel, and Moodle refreshes. */
export function useDashboardDataActions() {
  const [IDs] = useAtom(credentialsAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const [allGradesData, setAllGradesData] = useAtom(allGradesDataAtom);
  const [, setGradesData] = useAtom(gradesDataAtom);
  const [, setScheduleData] = useAtom(scheduleDataAtom);
  const [, setHostelData] = useAtom(hostelDataAtom);
  const [, setCalendarData] = useAtom(calendarDataAtom);
  const [, setMoodleData] = useAtom(moodleDataAtom);
  const [, setIsReloading] = useAtom(isReloadingAtom);
  const [pastSemesterData, setPastSemesterData] = useState<any>(null);
  useEffect(() => {
    if (allGradesData) setPastSemesterData(loadFrozenPastSemesters(allGradesData));
  }, [allGradesData]);

  const handleAllGradesFetch = useCallback(async () => {
    setIsReloading(true);
    try {
      const fetchedGrades = await runPageSync<any>({
        title: "All Grades",
        steps: [{ op: "all-grades", apply: setAllGradesData }],
        doneLine: "All grades reloaded successfully",
      });
      if (!fetchedGrades) return;

      appendSyncLine("Loading past semester data from cache…", "info");
      setPastSemesterData(loadFrozenPastSemesters(fetchedGrades));
      syncEngine.sync("pastAttendance", {
        semesterId: settings.currSemesterID,
        allGradesRes: fetchedGrades,
      }).then(() => {
        setPastSemesterData(loadFrozenPastSemesters(fetchedGrades));
      }).catch(() => {});
    } catch (error) {
      console.error(error);
    } finally {
      setIsReloading(false);
    }
  }, [setAllGradesData, setIsReloading, settings.currSemesterID]);

  const handleCalendarFetch = useCallback(async (calendarType?: typeof settings.calendarType) => {
    setIsReloading(true);
    try {
      await runPageSync({
        title: "Academic Calendar",
        steps: [{
          op: "calendar",
          args: {
            type: calendarType || "ALL",
            calendarType: calendarType || "ALL",
            semesterId: settings.currSemesterID,
          },
          apply: setCalendarData,
        }],
        doneLine: "Calendar reloaded successfully",
      });
      setSettings(previous => ({ ...previous, calendarType: calendarType || "ALL" }));
      localStorage.setItem("settings", JSON.stringify({ ...settings, calendarType }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsReloading(false);
    }
  }, [setCalendarData, setIsReloading, setSettings, settings]);

  const handleFetchGrades = useCallback(async () => {
    setIsReloading(true);
    try {
      await runPageSync({
        title: "Grades",
        steps: [{ op: "grades", args: { semesterId: settings.currSemesterID }, apply: setGradesData }],
        doneLine: "Grades reloaded successfully",
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsReloading(false);
    }
  }, [setGradesData, setIsReloading, settings.currSemesterID]);

  const handleFetchSchedule = useCallback(async () => {
    setIsReloading(true);
    try {
      await runPageSync({
        title: "Exam Schedule",
        steps: [{ op: "schedule", args: { semesterId: settings.currSemesterID }, apply: setScheduleData }],
        doneLine: "Exam schedule reloaded successfully",
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsReloading(false);
    }
  }, [setIsReloading, setScheduleData, settings.currSemesterID]);

  const handleHostelDetailsFetch = useCallback(async () => {
    setIsReloading(true);
    try {
      await runPageSync({
        title: "Hostel Details",
        steps: [{ op: "hostel", apply: setHostelData }],
        doneLine: "Hostel details reloaded successfully",
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsReloading(false);
    }
  }, [setHostelData, setIsReloading]);

  const handleFetchMoodle = useCallback(async (
    username = IDs.MoodleUsername,
    pass = IDs.MoodlePassword,
  ) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsReloading(true);
    try {
      const mergedData = await runPageSync<any>({
        title: "Moodle Data",
        steps: [{ op: "lms", args: { username, pass }, apply: setMoodleData }],
        doneLine: "Moodle data fetched successfully",
      });
      if (mergedData && !Array.isArray(mergedData)) {
        throw new Error("Moodle data came back in an unexpected shape");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsReloading(false);
    }
  }, [IDs.MoodlePassword, IDs.MoodleUsername, setIsReloading, setMoodleData]);

  return {
    allGradesData,
    pastSemesterData,
    handleAllGradesFetch,
    handleCalendarFetch,
    handleFetchGrades,
    handleFetchSchedule,
    handleHostelDetailsFetch,
    handleFetchMoodle,
  };
}
