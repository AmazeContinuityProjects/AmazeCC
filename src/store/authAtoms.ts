import { atom } from "jotai";

export type Credentials = {
  VtopUsername: string;
  VtopPassword: string;
  MoodleUsername: string;
  MoodlePassword: string;
};

export type IDs = Credentials;

export const defaultCredentials: Credentials = {
  VtopUsername: "",
  VtopPassword: "",
  MoodleUsername: "",
  MoodlePassword: "",
};

export const defaultIDs: IDs = defaultCredentials;

export const credentialsAtom = atom<Credentials>(defaultCredentials);
export const isLoggedInAtom = atom<boolean>(false);
export const demoModeAtom = atom<boolean>(false);
export const showIntroAtom = atom<boolean | null>(null as boolean | null);

/**
 * The VTOP `authorizedID` for the current session.
 *
 * It previously lived only inside the credential manager's memory, so nothing
 * outside a login callback could read it. That is fine for API calls, which
 * always happen inside one, but not for anything that has to decide on its own
 * whether the current user is a given person — the intro song's allowlist.
 *
 * Read-only from the app's point of view: it is set from the login result and
 * cleared on logout. It is a session identifier, not a credential, but it does
 * identify a student, so it is deliberately not persisted to `localStorage`.
 */
export const authorizedIDAtom = atom<string>("");
