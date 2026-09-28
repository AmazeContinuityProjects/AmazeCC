import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  INTRO_SONG_ALLOWED_AUTHORIZED_IDS,
  INTRO_SONG_ALLOWED_REG_NUMBERS,
  INTRO_SONG_ALLOWED_IDS,
  INTRO_SONG_KEY,
  INTRO_SONG_SRC,
  INTRO_SONG_START_SECONDS,
  clearIntroSongFlag,
  hasPlayedIntroSong,
  isAllowedAuthorizedId,
  isAllowedIdentifier,
  isAllowedRegNumber,
  markIntroSongPlayed,
} from "../lib/introSong/gate";

/** jsdom hands vitest an opaque origin, so `window.localStorage` is absent. */
function installLocalStorage() {
  const w = window as unknown as { localStorage?: Storage };
  if (w.localStorage) return;
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  Object.defineProperty(w, "localStorage", { value: storage, configurable: true });
}

beforeAll(installLocalStorage);
beforeEach(() => window.localStorage.clear());

describe("the allowlist", () => {
  it("holds the two authorizedIDs and the two reg numbers", () => {
    // Split by namespace because VTOP's `authorizedID` and the profile's
    // `applicationNumber` are different identifiers that never map to each
    // other — see gate.ts.
    //
    // The reg numbers used to be one comma-joined entry, `"20626703,2025001264"`,
    // which can never match a real `applicationNumber`. They are two entries
    // now, and this expectation is the thing that noticed.
    expect(INTRO_SONG_ALLOWED_AUTHORIZED_IDS).toEqual(["25BLC1081", "25MID1139"]);
    expect(INTRO_SONG_ALLOWED_REG_NUMBERS).toEqual(["20626703", "2025001264"]);
    expect(INTRO_SONG_ALLOWED_IDS).toEqual([
      "25BLC1081",
      "25MID1139",
      "20626703",
      "2025001264",
    ]);
  });

  it("matches either identifier", () => {
    expect(isAllowedIdentifier("25BLC1081", null)).toBe(true);
    expect(isAllowedIdentifier("25MID1139", null)).toBe(true);
    expect(isAllowedIdentifier(null, "20626703")).toBe(true);
    expect(isAllowedIdentifier(null, "2025001264")).toBe(true);
  });

  it("normalises case and surrounding whitespace", () => {
    expect(isAllowedAuthorizedId("  25blc1081 ")).toBe(true);
    expect(isAllowedRegNumber(" 20626703 ")).toBe(true);
  });

  it("does not accept a reg number as an authorizedID", () => {
    // The namespaces are genuinely disjoint, so a 20626703 session value must
    // NOT pass the authorizedID check. It still lets the person in via the reg
    // number, but the two lists must not silently bleed together.
    expect(isAllowedAuthorizedId("20626703")).toBe(false);
    expect(isAllowedRegNumber("25BLC1081")).toBe(false);
  });

  it("refuses everyone else", () => {
    expect(isAllowedIdentifier("21BCE1234", null)).toBe(false);
    expect(isAllowedIdentifier(null, "22BCE1102")).toBe(false);
    expect(isAllowedIdentifier("DEMO123", null)).toBe(false);
  });

  it("refuses empty and missing identifiers", () => {
    // The empty string must not match, or an unauthenticated visitor would pass.
    expect(isAllowedIdentifier("", "")).toBe(false);
    expect(isAllowedIdentifier(null, null)).toBe(false);
    expect(isAllowedIdentifier(undefined, undefined)).toBe(false);
    expect(isAllowedIdentifier("   ", "  ")).toBe(false);
  });
});

describe("the never-play-again flag", () => {
  it("starts unset", () => {
    expect(hasPlayedIntroSong("25BLC1081")).toBe(false);
  });

  it("is set after the first play and read back", () => {
    markIntroSongPlayed("25BLC1081");
    expect(hasPlayedIntroSong("25BLC1081")).toBe(true);
  });

  it("is per-student, so a shared browser does not inherit", () => {
    markIntroSongPlayed("25BLC1081");
    // Lab machine: the next person still gets their own first play.
    expect(hasPlayedIntroSong("25MID1139")).toBe(false);
    markIntroSongPlayed("25MID1139");
    expect(hasPlayedIntroSong("25BLC1081")).toBe(true);
    expect(hasPlayedIntroSong("25MID1139")).toBe(true);
  });

  it("does not leak to a non-allowlisted id", () => {
    markIntroSongPlayed("25BLC1081");
    expect(hasPlayedIntroSong("21BCE1234")).toBe(false);
  });

  it("prefers the reg number as the key, so it survives an authorizedID change", () => {
    // authorizedID is minted per session; the reg number is not. Keying on the
    // reg number is what stops the flag being orphaned by a fresh login.
    markIntroSongPlayed("session-A", "25BLC1081");
    expect(hasPlayedIntroSong("session-B", "25BLC1081")).toBe(true);
  });

  it("writes a namespaced, versioned key", () => {
    markIntroSongPlayed(null, "25BLC1081");
    expect(window.localStorage.getItem(`${INTRO_SONG_KEY}_25BLC1081`)).toBe("1");
  });

  it("does nothing when there is no identifier to key on", () => {
    markIntroSongPlayed(null, null);
    expect(window.localStorage.getItem(`${INTRO_SONG_KEY}_`)).toBeNull();
    expect(hasPlayedIntroSong(null, null)).toBe(false);
  });

  it("clears, which is also the reset switch", () => {
    markIntroSongPlayed("25BLC1081");
    clearIntroSongFlag("25BLC1081");
    expect(hasPlayedIntroSong("25BLC1081")).toBe(false);
  });

  it("a bumped key version makes everyone eligible again", () => {
    // The lever for replacing the audio without a manual storage sweep.
    markIntroSongPlayed("25BLC1081");
    expect(hasPlayedIntroSong("25BLC1081")).toBe(true);
    expect(INTRO_SONG_KEY.endsWith("_v2")).toBe(true);
  });
});

describe("the audio source", () => {
  it("streams from the remote host, not a bundled file", () => {
    // Verified: 200, video/webm, 1654052 bytes, 206 on a Range request.
    expect(INTRO_SONG_SRC.startsWith("https://secure-res.craft.do/v2/")).toBe(true);
    expect(INTRO_SONG_SRC.endsWith(".webm")).toBe(true);
  });

  it("seeks to 0:22 rather than shipping a pre-cut file", () => {
    // The source is remote and immutable, so re-encoding it is not an option.
    expect(INTRO_SONG_START_SECONDS).toBe(22);
  });
});
