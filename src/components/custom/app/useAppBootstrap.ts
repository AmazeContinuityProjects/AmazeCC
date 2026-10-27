"use client";

import { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import {
  allGradesDataAtom,
  calendarDataAtom,
  credentialsAtom,
  demoModeAtom,
  defaultSettings,
  gradesDataAtom,
  isLoggedInAtom,
  marksDataAtom,
  marksStatsAtom,
  moodleDataAtom,
  officialOdDataAtom,
  registeredEventsAtom,
  scheduleDataAtom,
  settingsAtom,
  showIntroAtom,
  tasksAtom,
  vitolDataAtom,
  hostelDataAtom,
} from "@/store";
import { migrateCustomHomework } from "@/lib/tasksStorage";
import { storage } from "@/lib/storage";
import { hasStoredVtopCredentials } from "./readBootstrapSnapshot";
import { useAttendanceState } from "./useAttendanceState";

/**
 * Restores browser-persisted state once when the authenticated app mounts.
 * Guest mode only reads the small credential/settings keys; academic caches are
 * parsed only when a saved user or demo session will actually use them.
 */
export function useAppBootstrap() {
  const [appHydrated, setAppHydrated] = useState(false);
  const setAttendanceAndOD = useAttendanceState();

  const setIDs = useSetAtom(credentialsAtom);
  const setMarksData = useSetAtom(marksDataAtom);
  const setMarksStats = useSetAtom(marksStatsAtom);
  const setGradesData = useSetAtom(gradesDataAtom);
  const setAllGradesData = useSetAtom(allGradesDataAtom);
  const setScheduleData = useSetAtom(scheduleDataAtom);
  const setHostelData = useSetAtom(hostelDataAtom);
  const setCalendarData = useSetAtom(calendarDataAtom);
  const setMoodleData = useSetAtom(moodleDataAtom);
  const setVitolData = useSetAtom(vitolDataAtom);
  const setRegisteredEvents = useSetAtom(registeredEventsAtom);
  const setTasks = useSetAtom(tasksAtom);
  const setOfficialOdData = useSetAtom(officialOdDataAtom);
  const setSettings = useSetAtom(settingsAtom);
  const setShowIntro = useSetAtom(showIntroAtom);
  const setDemoMode = useSetAtom(demoModeAtom);
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);

  useEffect(() => {
    const storedUsername = storage.username.get();
    const storedPassword = storage.password.get();
    const settingsRaw = storage.settings.get();
    const idsRaw = storage.ids.get();
    const isDemoStored = storage.demoMode.get();
    const hasVtop = hasStoredVtopCredentials(idsRaw, storedUsername, storedPassword);

    setIDs({
      VtopUsername: storedUsername || "",
      VtopPassword: storedPassword || "",
      MoodleUsername: storage.moodleUsername.get() || "",
      MoodlePassword: storage.moodlePassword.get() || "",
      ...(idsRaw || {}),
    });
    if (settingsRaw) setSettings({ ...defaultSettings, ...settingsRaw });
    setShowIntro(!localStorage.getItem("introDone"));
    setDemoMode(Boolean(isDemoStored));
    setIsLoggedIn(Boolean(isDemoStored || hasVtop));

    // The public landing page does not need cached academic records. Avoid
    // parsing potentially large attendance/grade/calendar payloads for guests.
    if (!isDemoStored && !hasVtop) {
      setAppHydrated(true);
      return;
    }

    const storedAttendance = storage.attendance.get();
    const storedMarks = storage.marks.get();
    const storedMarksStats = storage.marksStats.get();
    const storedGrades = storage.grades.get();
    const storedAllGrades = storage.allGrades.get();
    const storedSchedule = storage.schedule.get();
    const storedHostel = storage.hostel.get();
    const calendar = storage.calendar.get();
    const moodleData = storage.moodleData.get();
    const vitolData = storage.vitolData.get();
    const storedRegisteredEvents = storage.registeredEvents.get();

    if (storedAttendance?.attendance) setAttendanceAndOD(storedAttendance);
    if (storedMarks) setMarksData(storedMarks as object);
    if (storedMarksStats) setMarksStats(storedMarksStats as Record<string, unknown>);
    if (storedSchedule) setScheduleData(storedSchedule as object);
    if (storedGrades) setGradesData(storedGrades as object);
    if (storedAllGrades) setAllGradesData(storedAllGrades);
    if (storedHostel) setHostelData(storedHostel as object);
    if (calendar) setCalendarData(calendar as object);
    if (moodleData) setMoodleData(moodleData as never[]);
    if (vitolData) setVitolData(vitolData as never[]);
    if (storedRegisteredEvents) setRegisteredEvents(storedRegisteredEvents);

    try {
      setTasks(migrateCustomHomework());
    } catch {}

    try {
      const bootSemester = (settingsRaw as any)?.currSemesterID as string | undefined;
      if (bootSemester) {
        const storedOd = storage.officialOd.get(bootSemester);
        if (storedOd) setOfficialOdData(storedOd);
      }
    } catch {}

    setAppHydrated(true);
  }, [
    setAllGradesData,
    setAttendanceAndOD,
    setCalendarData,
    setDemoMode,
    setGradesData,
    setHostelData,
    setIDs,
    setIsLoggedIn,
    setMarksData,
    setMarksStats,
    setMoodleData,
    setOfficialOdData,
    setRegisteredEvents,
    setScheduleData,
    setSettings,
    setShowIntro,
    setTasks,
    setVitolData,
  ]);

  return { appHydrated, setAttendanceAndOD };
}
