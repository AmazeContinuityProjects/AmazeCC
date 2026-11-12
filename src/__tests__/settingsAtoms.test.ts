/**
 * The settings atom's storage contract.
 *
 * `settingsAtom` is an atomWithStorage whose `getItem` merges the persisted
 * blob over `defaultSettings` — that merge is the migration shim for blobs
 * written before a field existed. These tests pin both halves: the shim on
 * read, and write-through on `set`.
 */
import { installLocalStorage } from "./helpers/localStorage";
installLocalStorage();
import { getDefaultStore } from "jotai";
import { afterEach, describe, expect, it } from "vitest";
import { defaultSettings, settingsAtom } from "@/store/settingsAtoms";

const store = getDefaultStore();

afterEach(() => {
  // Reset the module-global store so one test's writes don't leak into the
  // next. The set persists defaults back into localStorage, which is fine:
  // every test below writes its own key before reading.
  store.set(settingsAtom, defaultSettings);
  localStorage.clear();
});

describe("settingsAtom storage", () => {
  it("reads a legacy blob over the defaults (migration shim)", () => {
    // A blob from before `decimalValues` (etc.) existed: only the fields the
    // user actually changed are present.
    localStorage.setItem("settings", JSON.stringify({ targetAttendance: 80 }));

    const unsub = store.sub(settingsAtom, () => {}); // mounts -> reads storage
    const value = store.get(settingsAtom);
    unsub();

    expect(value.targetAttendance).toBe(80);
    // The missing field picks up its default instead of coming back undefined.
    expect(value.decimalValues).toBe(defaultSettings.decimalValues);
    expect(value.calendarType).toBe(defaultSettings.calendarType);
  });

  it("falls back to defaults for a corrupt blob", () => {
    localStorage.setItem("settings", "{not json");

    const unsub = store.sub(settingsAtom, () => {});
    const value = store.get(settingsAtom);
    unsub();

    expect(value).toEqual(defaultSettings);
  });

  it("persists every set through to localStorage", () => {
    store.set(settingsAtom, (prev) => ({ ...prev, friendlyName: "Arjun Kumar" }));

    const raw = JSON.parse(localStorage.getItem("settings") || "{}");
    expect(raw.friendlyName).toBe("Arjun Kumar");
    // The write carries the whole settings object, not just the patch.
    expect(raw.targetAttendance).toBe(defaultSettings.targetAttendance);
  });
});
