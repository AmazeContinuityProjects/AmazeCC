import { beforeEach, describe, expect, it } from "vitest";
import { backupFilename, createBackup, describeBackup, isBackupKey, parseBackup, restoreBackup } from "../lib/backup";
import { CREDENTIAL_KEYS } from "../lib/forgetDevice";

beforeEach(() => localStorage.clear());

describe("backup contents", () => {
  it("includes the student's own data and never credentials or VTOP caches", () => {
    localStorage.setItem("tasks", JSON.stringify([{ id: 1 }, { id: 2 }]));
    localStorage.setItem("ffcs_timetables", JSON.stringify([{ id: "a" }]));
    localStorage.setItem("settings", "{}");
    localStorage.setItem("IDs", JSON.stringify({ VtopUsername: "21BCE0000", VtopPassword: "secret" }));
    localStorage.setItem("password", "secret");
    localStorage.setItem("cred_vault_v1", "ciphertext");
    localStorage.setItem("marksTokensV1", "token");
    localStorage.setItem("attendance", "{}");
    localStorage.setItem("ffcs_analytics_queue", "[]");

    const b = createBackup();
    expect(Object.keys(b.data).sort()).toEqual(["ffcs_timetables", "settings", "tasks"]);
    expect(JSON.stringify(b)).not.toContain("secret");
    expect(describeBackup(b)).toEqual(["2 tasks", "1 FFCS plans", "settings"]);
  });

  it("no credential key is ever a backup key", () => {
    for (const k of [...CREDENTIAL_KEYS, "cred_vault_v1", "cred_vault_session", "marksTokensV1"]) {
      expect(isBackupKey(k), k).toBe(false);
    }
  });
});

describe("restore", () => {
  it("round-trips through a file", () => {
    localStorage.setItem("tasks", "[1]");
    localStorage.setItem("ffcs_friends", "[]");
    const text = JSON.stringify(createBackup());
    localStorage.clear();
    localStorage.setItem("theme", "light");

    const parsed = parseBackup(text);
    if (!("backup" in parsed)) throw new Error("expected a valid backup");
    expect(restoreBackup(parsed.backup)).toBe(2);
    expect(localStorage.getItem("tasks")).toBe("[1]");
    expect(localStorage.getItem("theme")).toBe("light"); // untouched
  });

  it("drops keys outside the allowlist, so a crafted file cannot plant a credential", () => {
    const crafted = JSON.stringify({
      format: "amazecc-backup",
      version: 1,
      exportedAt: "",
      data: { tasks: "[]", IDs: '{"VtopPassword":"evil"}', password: "evil" },
    });
    const parsed = parseBackup(crafted);
    if (!("backup" in parsed)) throw new Error("expected a valid backup");
    expect(parsed.skipped.sort()).toEqual(["IDs", "password"]);
    restoreBackup(parsed.backup);
    expect(localStorage.getItem("IDs")).toBeNull();
    expect(localStorage.getItem("password")).toBeNull();
  });

  it.each([
    ["not json", /valid JSON/],
    [JSON.stringify({ hello: 1 }), /isn't an AmazeCC backup/],
    [JSON.stringify({ format: "amazecc-backup", version: 99, data: {} }), /newer version/],
  ])("rejects %s with a clear message", (text, msg) => {
    const parsed = parseBackup(text);
    expect("error" in parsed && parsed.error).toMatch(msg);
  });
});

it("names the file by date", () => {
  expect(backupFilename(new Date("2026-11-10T12:00:00Z"))).toBe("amazecc-backup-2026-11-10.json");
});
