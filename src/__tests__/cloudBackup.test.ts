import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup } from "../lib/cloudBackup";

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const backup = { format: "amazecc-backup" as const, version: 1, exportedAt: "2026-11-10", data: { tasks: '[{"id":1}]' } };

describe("cloud backup encryption", () => {
  it("round-trips with the right passphrase and hides the content", async () => {
    const env = await encryptBackup(backup, "correct horse", { subtle, iterations: 100_000 });
    expect(env.ciphertext).not.toContain("tasks");
    expect(await decryptBackup(env, "correct horse", { subtle })).toEqual(backup);
  });

  it("refuses a wrong passphrase with a clear message", async () => {
    const env = await encryptBackup(backup, "correct horse", { subtle, iterations: 100_000 });
    await expect(decryptBackup(env, "wrong horse!", { subtle })).rejects.toThrow(/passphrase doesn't open/);
  });

  it("requires a passphrase of at least 8 characters", async () => {
    await expect(encryptBackup(backup, "short", { subtle })).rejects.toThrow(/at least 8/);
  });
});
