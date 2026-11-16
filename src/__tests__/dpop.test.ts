import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const DB_NAME = "amazecc-dpop";
const STORE = "keys";
const KEY_ID = "default";

function decodeBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function clearKeyStore(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function storeKeys(pair: CryptoKeyPair): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id: KEY_ID, publicKey: pair.publicKey, privateKey: pair.privateKey });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function expectVerifiableProof(proof: string): Promise<void> {
  const [encodedHeader, encodedPayload, encodedSignature] = proof.split(".");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedHeader))) as {
    jwk: JsonWebKey;
  };
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as { iat: unknown };
  expect(header.jwk.key_ops).toEqual(["verify"]);
  expect(typeof payload.iat).toBe("number");

  const publicKey = await crypto.subtle.importKey("jwk", header.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "verify",
  ]);
  const verified = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  expect(verified).toBe(true);
}

describe("DPoP proof keys", () => {
  beforeEach(async () => {
    vi.resetModules();
    await clearKeyStore();
  });

  it("creates a public JWK that the server can use to verify the proof", async () => {
    const { dpopProof, getDpopKeys } = await import("../lib/dpop");
    const pair = await getDpopKeys();

    expect(pair.privateKey.usages).toContain("sign");
    expect(pair.publicKey.usages).toContain("verify");
    await expectVerifiableProof(await dpopProof("POST", "https://auth.amazecc.com/api/auth/oauth2/token"));
  });

  it("normalizes public JWK metadata for keys already stored by older versions", async () => {
    const legacyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    await storeKeys(legacyPair);

    const { dpopProof } = await import("../lib/dpop");
    await expectVerifiableProof(await dpopProof("POST", "https://auth.amazecc.com/api/auth/oauth2/token"));
  });
});
