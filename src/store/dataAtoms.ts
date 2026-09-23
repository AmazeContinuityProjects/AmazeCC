import { atom } from "jotai";
import { attendanceRes } from "@/types/data/attendance";
import { AllGradesRes } from "@/types/data/allgrades";
import type { OfficialOdResponse } from "@/types/data/od";

export const attendanceDataAtom = atom<attendanceRes | null>({});
export const marksDataAtom = atom<object>({});
export const gradesDataAtom = atom<object>({});
export const allGradesDataAtom = atom<AllGradesRes>({});
export const scheduleDataAtom = atom<object>({});
export const hostelDataAtom = atom<object>({});
export const calendarDataAtom = atom<object>({});
export const attendancePercentageAtom = atom<object>({});
export const odHoursDataAtom = atom<object>({});
// NOTE: strictNullChecks is off in this repo, so a bare `null` initialiser would
// match jotai's read-function overload and yield a read-only atom. The cast
// keeps the runtime `null` while selecting the PrimitiveAtom overload.
export const officialOdDataAtom = atom<OfficialOdResponse | null>(
  null as unknown as OfficialOdResponse,
);
export const moodleDataAtom = atom<any[]>([]);
export const vitolDataAtom = atom<any[]>([]);
export const registeredEventsAtom = atom<any[]>([]);
export const eventHubEventsAtom = atom<any[]>([]);
