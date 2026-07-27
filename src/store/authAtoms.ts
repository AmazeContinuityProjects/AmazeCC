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
