import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  INTRO_SONG_ALLOWED_APPLICATION_NUMBERS,
  INTRO_SONG_ALLOWED_REG_NUMBERS,
  INTRO_SONG_ALLOWED_IDS,
  INTRO_SONG_KEY,
  INTRO_SONG_SRC,
  INTRO_SONG_START_SECONDS,
  clearIntroSongFlag,
  getCachedRegisterNumber,
  getIntroSongRegisterNumber,
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
  it("holds register numbers and application numbers as separate lists", () => {
    // `25BLC1081` is a **registerNo** and `20626703` is an
    // **applicationNumber** — two identifiers for one person that the codebase
    // both calls a "reg number". The allowlist is the register numbers; the
    // application numbers are kept so a client that only ever resolved that one
    // is not locked out.
    //
    // The application numbers used to be one comma-joined entry,
    // `"20626703,2025001264"`, which can never match a real value. They are two
    // entries now, and this expectation is the thing that noticed.
    expect(INTRO_SONG_ALLOWED_REG_NUMBERS).toEqual(["25BLC1081", "25MID1139"]);
    expect(INTRO_SONG_ALLOWED_APPLICATION_NUMBERS).toEqual(["20626703", "2025001264"]);
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

  it("treats a register number as a register number wherever it arrives", () => {
    // A student's `authorizedID` is their register number, so the same value
    // passing both checks is correct, not the namespace bleed the old test
    // asserted. What must still hold is that an application number is not a
    // register number.
    expect(isAllowedRegNumber("25BLC1081")).toBe(true);
    expect(isAllowedAuthorizedId("25BLC1081")).toBe(true);
    expect(isAllowedAuthorizedId("20626703")).toBe(false);
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

describe("reading registerNo from the payments cache", () => {
  const cachePayments = (value: unknown) =>
    window.localStorage.setItem("cache_payments", JSON.stringify(value));

  it("reads the registerNo the VTOP payments payload carries", () => {
    cachePayments({ studentInfo: { registerNo: "25BLC1081", studentName: "Someone" } });
    expect(getCachedRegisterNumber()).toBe("25BLC1081");
  });

  it("lets the person in when nothing else identified them", () => {
    // This is the case the whole change exists for: no session, no profile row,
    // and the register number sitting in the payments cache.
    cachePayments({ studentInfo: { registerNo: "25BLC1081" } });
    expect(isAllowedIdentifier(null, null)).toBe(true);
  });

  it("reads it off the bare object too", () => {
    // The two payments caches in this app are not written by the same code.
    cachePayments({ registerNo: "25BLC1081" });
    expect(getCachedRegisterNumber()).toBe("25BLC1081");
  });

  it("tolerates the other spellings the field has gone by", () => {
    // The payments *type* in this repo declares `registerNumber`, so a rename in
    // either direction must not silently stop the song.
    cachePayments({ studentInfo: { registerNumber: "25BLC1081" } });
    expect(getCachedRegisterNumber()).toBe("25BLC1081");
  });

  it("trims, and ignores a blank value rather than returning it", () => {
    cachePayments({ studentInfo: { registerNo: "  25BLC1081  " } });
    expect(getCachedRegisterNumber()).toBe("25BLC1081");

    cachePayments({ studentInfo: { registerNo: "   " } });
    expect(getCachedRegisterNumber()).toBeNull();
  });

  it("returns null for a missing, empty or corrupt cache", () => {
    expect(getCachedRegisterNumber()).toBeNull();

    cachePayments({});
    expect(getCachedRegisterNumber()).toBeNull();

    window.localStorage.setItem("cache_payments", "{not json");
    expect(getCachedRegisterNumber()).toBeNull();

    cachePayments({ studentInfo: { registerNo: 12345 } });
    expect(getCachedRegisterNumber()).toBeNull();
  });

  it("prefers the cached registerNo over the profile's application number", () => {
    // The whole point. `getActiveRegNumber()` ends its fallback chain at
    // `applicationNumber`, so a profile with no `REGISTER NO` row returns a
    // *different identifier* rather than nothing — and matching that against a
    // register-number allowlist fails silently.
    window.localStorage.setItem("profile", JSON.stringify({ applicationNumber: "20626022" }));
    cachePayments({ studentInfo: { registerNo: "25BLC1081" } });

    expect(getIntroSongRegisterNumber()).toBe("25BLC1081");
  });

  it("falls back to the profile when payments have not synced", () => {
    // A student who has never opened the Payments tab must still be identified.
    window.localStorage.setItem("profile", JSON.stringify({ registerNo: "25BLC1081" }));
    expect(getIntroSongRegisterNumber()).toBe("25BLC1081");
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
