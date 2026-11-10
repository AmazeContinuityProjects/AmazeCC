import { describe, expect, it } from "vitest";
import { CREDENTIAL_KEYS, forgetStoredCredentials } from "../lib/forgetDevice";
import { KEYS } from "../lib/storage";

function memoryStore(seed: Record<string, string>) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("forgetStoredCredentials", () => {
  it("removes every login and session token", () => {
    const store = memoryStore({
      [KEYS.IDS]: JSON.stringify({ VtopUsername: "21BCE0000", VtopPassword: "secret" }),
      [KEYS.PASSWORD]: "secret",
      [KEYS.MOODLE_PASSWORD]: "secret",
      [KEYS.KOHA_PASSWORD]: "secret",
      [KEYS.VITOL_PASSWORD]: "secret",
      [KEYS.EVENT_HUB_SESSION]: "token",
    });
    const removed = forgetStoredCredentials(store);
    expect(removed.sort()).toEqual(
      [KEYS.IDS, KEYS.PASSWORD, KEYS.MOODLE_PASSWORD, KEYS.KOHA_PASSWORD, KEYS.VITOL_PASSWORD, KEYS.EVENT_HUB_SESSION].sort(),
    );
    for (const key of CREDENTIAL_KEYS) expect(store.getItem(key)).toBeNull();
  });

  it("keeps tasks, FFCS plans, friends, settings and theme", () => {
    const kept = {
      [KEYS.TASKS]: "[]",
      [KEYS.FFCS_TIMETABLES]: "[]",
      [KEYS.FFCS_FRIENDS]: "[]",
      [KEYS.SETTINGS]: "{}",
      [KEYS.THEME]: "dark",
      [KEYS.ATTENDANCE]: "{}",
    };
    const store = memoryStore({ ...kept, [KEYS.PASSWORD]: "secret" });
    forgetStoredCredentials(store);
    expect(Object.fromEntries(store.map)).toEqual(kept);
  });

  it("does not list user data as a credential", () => {
    for (const key of [KEYS.TASKS, KEYS.FFCS_TIMETABLES, KEYS.SETTINGS, KEYS.THEME]) {
      expect(CREDENTIAL_KEYS).not.toContain(key);
    }
  });
});
