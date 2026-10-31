import { describe, it, expect } from "vitest";
import { isSupportedReviewsSchemaVersion, ENABLE_AMAZE_REVIEWS } from "@/lib/reviewsService";

describe("reviews snapshot contract (consumer side)", () => {
  it("accepts any 1.x.y snapshot version (older or newer minor/patch)", () => {
    for (const v of ["1.0.0", "1.0.9", "1.3.0", "1.12.4"]) {
      expect(isSupportedReviewsSchemaVersion(v)).toBe(true);
    }
  });

  it("rejects an unknown major, malformed or missing versions", () => {
    for (const v of ["2.0.0", "0.9.0", "1", "1.0", "v1.0.0", "", null, undefined, 1]) {
      expect(isSupportedReviewsSchemaVersion(v)).toBe(false);
    }
  });

  it("ships with the reviews feature flag OFF unless the env opts in", () => {
    // The test environment does not set the flag, so merging must not enable it.
    expect(ENABLE_AMAZE_REVIEWS).toBe(false);
  });
});
