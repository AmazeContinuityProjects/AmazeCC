import { atom } from "jotai";

export const activeTabAtom = atom<string>("home");
export const activeSubTabAtom = atom<string>("courses-simplified");
export const activeAttendanceSubTabAtom = atom<string>("attendance");
export const activeToolsSubTabAtom = atom<string>("overview");
export const activeDayscholarSubTabAtom = atom<string>("finder");
export const activeMoreSubTabAtom = atom<string>("social");
/**
 * The settings screen is a hub of eight category sections, so the landing value
 * is the hub's own id, `"settings"` — a section id (`"profile"`, `"preferences"`,
 * …) means "open straight into that section".
 *
 * This was `"info"`, a legacy alias `ProfilePage` still maps to `"profile"`, so
 * a cold start opened the Student Profile section instead of the hub. `"info"`
 * is deliberately still *accepted* as input: persisted screen history keys of
 * the form `profile:info` can still be restored.
 */
export const activeProfileSubTabAtom = atom<string>("settings");
export const hostelActiveSubTabAtom = atom<string>("mess");
export const activeDayAtom = atom<string>("");

export const commandPaletteOpenAtom = atom<boolean>(false);
export const isShortcutsHelpOpenAtom = atom<boolean>(false);

/**
 * Set by the command palette's quick-add command; consumed by TasksTab to open
 * the create sheet. `nonce` forces a re-fire when the same title is used twice.
 */
export const tasksQuickAddRequestAtom = atom<{ title: string; nonce: number } | null>(
  null as unknown as { title: string; nonce: number }
);
export const isReloadingAtom = atom<boolean>(false);
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
