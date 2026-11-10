import { api } from "./sync-engine";
import { createBackup, parseBackup, restoreBackup, type Backup } from "./backup";

/**
 * Optional cloud copy of the local backup (lib/backup.ts), end-to-end
 * encrypted. The passphrase never leaves the device: it is stretched with
 * PBKDF2-SHA256 (600k iterations, random salt) into an AES-256-GCM key, and
 * only the ciphertext plus those public parameters are sent. AmazeCC's server
 * cannot read it, and a forgotten passphrase cannot be recovered.
 *
 * The server keys the copy by the student's VTOP identity (it asks VTOP who
 * the session belongs to), so it follows them to a new device.
 */

export const KDF_ITERATIONS = 600_000;
export const MIN_PASSPHRASE = 8;

export interface Envelope {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase: string, salt: BufferSource, iterations: number, subtle: SubtleCrypto) {
  const base = await subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(
  backup: Backup,
  passphrase: string,
  { subtle = crypto.subtle, iterations = KDF_ITERATIONS } = {},
): Promise<Envelope> {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error(`Use a passphrase of at least ${MIN_PASSPHRASE} characters.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations, subtle);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(backup))));
  return { v: 1, kdf: "PBKDF2-SHA256", iterations, salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(ct) };
}

export async function decryptBackup(env: Envelope, passphrase: string, { subtle = crypto.subtle } = {}): Promise<Backup> {
  const key = await deriveKey(passphrase, fromB64(env.salt), env.iterations, subtle);
  let plain: ArrayBuffer;
  try {
    plain = await subtle.decrypt({ name: "AES-GCM", iv: fromB64(env.iv) }, key, fromB64(env.ciphertext));
  } catch {
    throw new Error("That passphrase doesn't open this backup. Check it and try again.");
  }
  const parsed = parseBackup(dec.decode(plain));
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.backup;
}

function unwrap(res: any) {
  if (!res || res.success === false) {
    const code = res?.error;
    if (code === "too_large") throw new Error("This backup is too large for the cloud (over 512 KB).");
    if (code === "vtop_identity_unresolved" || code === "missing_credentials")
      throw new Error("Sign in to VTOP first, so AmazeCC knows whose backup this is.");
    throw new Error("The cloud backup service isn't available right now. Try again later.");
  }
  return res;
}

export async function uploadCloudBackup(passphrase: string): Promise<string | null> {
  const envelope = await encryptBackup(createBackup(), passphrase);
  const res = unwrap(await api("backup", { method: "POST", auth: "vtop", body: { action: "put", envelope } }));
  return res.updatedAt ?? null;
}

export async function getCloudBackupInfo(): Promise<{ envelope: Envelope | null; updatedAt: string | null }> {
  const res = unwrap(await api("backup", { method: "POST", auth: "vtop", body: { action: "get" } }));
  return { envelope: res.envelope ?? null, updatedAt: res.updatedAt ?? null };
}

export async function restoreCloudBackup(passphrase: string): Promise<number> {
  const { envelope } = await getCloudBackupInfo();
  if (!envelope) throw new Error("There is no cloud backup for this account yet.");
  return restoreBackup(await decryptBackup(envelope, passphrase));
}

export async function deleteCloudBackup(): Promise<void> {
  unwrap(await api("backup", { method: "POST", auth: "vtop", body: { action: "delete" } }));
}
