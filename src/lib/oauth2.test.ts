import { describe, it, expect } from "vitest";
import { createPkcePair, getAccessTokenSync } from "./oauth2";
import { webcrypto } from "node:crypto";

// Node's test environment provides WebCrypto via globalThis.crypto in Node 20+,
// but be explicit so this suite also runs on older engines.
if (!globalThis.crypto?.subtle) {
  (globalThis as Record<string, unknown>).crypto = webcrypto;
}

describe("oauth2 PKCE helpers", () => {
  it("produces a verifier/challenge pair where challenge = base64url(sha256(verifier))", async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{60,70}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const bytes = new Uint8Array(digest);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const expected = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(challenge).toBe(expected);
  });

  it("never produces the same verifier twice", async () => {
    const a = await createPkcePair();
    const b = await createPkcePair();
    expect(a.verifier).not.toBe(b.verifier);
  });

  it("getAccessTokenSync returns null when there is no stored token", () => {
    expect(getAccessTokenSync()).toBeNull();
  });
});
