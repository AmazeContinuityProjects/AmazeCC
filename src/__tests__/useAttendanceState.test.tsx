import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Provider, createStore, useAtomValue } from "jotai";
import {
  attendanceDataAtom,
  attendancePercentageAtom,
  odHoursDataAtom,
} from "@/store";
import type { attendanceRes } from "@/types/data/attendance";
import { useAttendanceState } from "@/components/custom/app/useAttendanceState";
import { installLocalStorage } from "./helpers/localStorage";

const localStorageStub = installLocalStorage();

afterEach(() => {
  localStorageStub.clear();
});

describe("useAttendanceState", () => {
  it("updates attendance, percentage, and chronologically ordered OD totals", () => {
    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => ({
      setAttendance: useAttendanceState(),
      attendance: useAtomValue(attendanceDataAtom),
      percentage: useAtomValue(attendancePercentageAtom),
      odHours: useAtomValue(odHoursDataAtom),
    }), { wrapper });
    const attendance = {
      attendance: [
        {
          courseCode: "CSE1001",
          courseTitle: "Algorithms",
          courseType: "Theory",
          slotName: "A1",
          attendedClasses: 9,
          totalClasses: 10,
          viewLink: [{ date: "2026-10-05", status: "On Duty" }],
        },
        {
          courseCode: "CSE1002",
          courseTitle: "Systems Lab",
          courseType: "Lab",
          slotName: "L1+L2",
          attendedClasses: 3,
          totalClasses: 5,
          viewLink: [{ date: "2026-10-04", status: "On Duty" }],
        },
      ],
    } as attendanceRes;

    act(() => result.current.setAttendance(attendance));

    expect(result.current.attendance).toEqual(attendance);
    expect(result.current.percentage).toEqual({ percentage: 80, str: "12/15" });
    expect(result.current.odHours).toEqual([
      {
        date: "2026-10-04",
        courses: [{ title: "Systems Lab", type: "LAB", hours: 2 }],
        total: 2,
      },
      {
        date: "2026-10-05",
        courses: [{ title: "Algorithms", type: "TH", hours: 1 }],
        total: 1,
      },
    ]);
  });

  it("reports zero for an empty schedule instead of NaN", () => {
    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => ({
      setAttendance: useAttendanceState(),
      percentage: useAtomValue(attendancePercentageAtom),
    }), { wrapper });

    act(() => result.current.setAttendance({ attendance: [] }));

    expect(result.current.percentage).toEqual({ percentage: 0, str: "0/0" });
  });
});
