import { atom } from "jotai";

export const activeTabAtom = atom<string>("home");
export const activeSubTabAtom = atom<string>("courses-simplified");
export const activeAttendanceSubTabAtom = atom<string>("attendance");
export const activeToolsSubTabAtom = atom<string>("overview");
export const activeDayscholarSubTabAtom = atom<string>("finder");
export const activeQBankSubTabAtom = atom<string>("archive");
export const activeMoreSubTabAtom = atom<string>("social");
export const activeProfileSubTabAtom = atom<string>("info");
export const hostelActiveSubTabAtom = atom<string>("mess");
export const activeDayAtom = atom<string>("");

export const commandPaletteOpenAtom = atom<boolean>(false);
export const isShortcutsHelpOpenAtom = atom<boolean>(false);
export const isReloadingAtom = atom<boolean>(false);
export const isLoadingAtom = atom<boolean>(true);
export const progressBarAtom = atom<number>(0);
export const messageAtom = atom<string, [string | ((prev: string) => string)], void>(
  "",
  (get, set, update) => {
    const prev = get(messageAtom);
    const next = typeof update === "function" ? update(prev) : update;
    const lines = next.split("\n");
    const capped = lines.length > 60 ? lines.slice(-60).join("\n") : next;
    set(messageAtom, capped);
  }
);
export const odHoursIsOpenAtom = atom<boolean>(false);
export const gradesDisplayIsOpenAtom = atom<boolean>(false);
export const isOfflineAtom = atom<boolean>(false);
export const showReloadBannerAtom = atom<boolean>(false);
