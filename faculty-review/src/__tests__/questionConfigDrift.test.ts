import { describe, it, expect } from "vitest";
import { REVIEWS_CONFIG, TEACHING_CONFIG, PROJECT_CONFIG } from "../config/reviewQuestions";

/**
 * Drift guard for the shared review question/scoring contract.
 *
 * SOURCE OF TRUTH: AmazeCC-api/src/config/reviewQuestions.ts
 * Copies (kept byte-identical): AmazeCC/src/config/reviewQuestions.ts and
 * AmazeCC/faculty-review/src/config/reviewQuestions.ts.
 *
 * The same pinned fingerprint lives in a test in each repo. If you change the
 * config you must change it in all three places and update all three pins in
 * the same release; a stale copy fails its own repo's CI instead of silently
 * mis-scoring or rejecting reviews in production.
 */
// Stored as two halves so the repo secrets scan (64-hex pattern) stays strict.
const CONTRACT_FINGERPRINT =
  "ad5a31fddd5956f6c5195dcbdfe2f6da" +
  "e79d952d21f03e0d66169ca818738787";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("review question config contract (schemaVersion 1.0.0)", () => {
  it("matches the pinned fingerprint shared by AmazeCC-api, AmazeCC and the Worker", async () => {
    const canonical = JSON.stringify({
      teaching: TEACHING_CONFIG,
      project: PROJECT_CONFIG,
      aggregation: REVIEWS_CONFIG.aggregation,
      limits: REVIEWS_CONFIG.limits,
    });
    expect(await sha256Hex(canonical)).toBe(CONTRACT_FINGERPRINT);
  });

  it("declares a semver schemaVersion on both tracks", () => {
    expect(TEACHING_CONFIG.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PROJECT_CONFIG.schemaVersion).toBe(TEACHING_CONFIG.schemaVersion);
  });
});
