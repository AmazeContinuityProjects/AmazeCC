"use client";

import { useCallback } from "react";
import { useSetAtom } from "jotai";
import {
  attendanceDataAtom,
  attendancePercentageAtom,
  odHoursDataAtom,
} from "@/store";
import type { attendanceRes, ODListItem, ODListRaw } from "@/types/data/attendance";

/**
 * Keeps attendance-derived state together: the attendance payload, the summary
 * displayed in the app shell, and the list of OD hours used by other features.
 */
export function useAttendanceState() {
  const setAttendanceData = useSetAtom(attendanceDataAtom);
  const setAttendancePercentage = useSetAtom(attendancePercentageAtom);
  const setODhoursData = useSetAtom(odHoursDataAtom);

  return useCallback((attendance: attendanceRes): void => {
    setAttendanceData(attendance);

    // Compare with the last saved attendance to record Present ↔ OD changes.
    const prevAttRaw = localStorage.getItem("attendance");
    if (prevAttRaw) {
      try {
        const prevAttRes: attendanceRes = JSON.parse(prevAttRaw);
        const trackerRaw = localStorage.getItem("wastedODsTracker");
        const tracker = trackerRaw ? JSON.parse(trackerRaw) : {};
        let trackerUpdated = false;

        attendance.attendance?.forEach(newCourse => {
          const oldCourse = prevAttRes.attendance?.find(c => c.courseCode === newCourse.courseCode);
          if (oldCourse && Array.isArray(oldCourse.viewLink) && Array.isArray(newCourse.viewLink)) {
            newCourse.viewLink.forEach((newDay: any) => {
              const oldDay = (oldCourse.viewLink as any[]).find((d: any) => d.date === newDay.date);
              if (oldDay) {
                const oldStatus = oldDay.status.toLowerCase();
                const newStatus = newDay.status.toLowerCase();

                if (!tracker[newDay.date]) tracker[newDay.date] = {};

                if (oldStatus === "present" && (newStatus === "on duty" || newStatus === "partial od")) {
                  tracker[newDay.date][newCourse.courseCode] = {
                    courseTitle: newCourse.courseTitle,
                    type: newCourse.courseType,
                    slotName: newCourse.slotName,
                    status: "wasted"
                  };
                  trackerUpdated = true;
                } else if ((oldStatus === "on duty" || oldStatus === "partial od") && newStatus === "present") {
                  if (tracker[newDay.date][newCourse.courseCode]?.status === "wasted") {
                    tracker[newDay.date][newCourse.courseCode].status = "recovered";
                    trackerUpdated = true;
                  }
                }
              }
            });
          }
        });

        if (trackerUpdated) {
          localStorage.setItem("wastedODsTracker", JSON.stringify(tracker));
        }
      } catch (error) {
        console.error("Error comparing attendance states:", error);
      }
    }

    const courses = attendance.attendance ?? [];
    let totalClass = 0;
    let attendedClasses = 0;
    courses.forEach(course => {
      totalClass += course.totalClasses || 0;
      attendedClasses += course.attendedClasses || 0;
    });
    const percentage = totalClass > 0
      ? Math.round(attendedClasses * 10000 / totalClass) / 100
      : 0;
    setAttendancePercentage({ percentage, str: `${attendedClasses}/${totalClass}` });

    const odList: ODListRaw = {};
    courses.forEach(course => {
      if (!Array.isArray(course.viewLink)) return;

      course.viewLink.forEach(day => {
        if (day.status !== "On Duty") return;
        if (!odList[day.date]) odList[day.date] = [];
        const hours = course.slotName.startsWith("L") ? 2 : 1;
        odList[day.date].push({
          title: course.courseTitle,
          type: course.slotName.startsWith("L") ? "LAB" : "TH",
          hours,
        });
      });
    });

    const formattedList: ODListItem[] = Object.entries(odList)
      .map(([date, odCourses]) => ({
        date,
        courses: odCourses,
        total: odCourses.reduce((sum, course) => sum + course.hours, 0),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setODhoursData(formattedList);
  }, [setAttendanceData, setAttendancePercentage, setODhoursData]);
}
