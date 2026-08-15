import { atom } from "jotai";
import { attendanceRes } from "@/types/data/attendance";
import { AllGradesRes } from "@/types/data/allgrades";

export const attendanceDataAtom = atom<attendanceRes | null>({});
export const marksDataAtom = atom<object>({});
export const gradesDataAtom = atom<object>({});
export const allGradesDataAtom = atom<AllGradesRes>({});
export const scheduleDataAtom = atom<object>({});
export const hostelDataAtom = atom<object>({});
export const calendarDataAtom = atom<object>({});
export const attendancePercentageAtom = atom<object>({});
export const odHoursDataAtom = atom<object>({});
export const moodleDataAtom = atom<any[]>([]);
export const vitolDataAtom = atom<any[]>([]);
export const registeredEventsAtom = atom<any[]>([]);
export const eventHubEventsAtom = atom<any[]>([]);
