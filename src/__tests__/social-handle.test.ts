import { describe, expect, it } from "vitest";
import {
  HANDLE_ALPHABET,
  HANDLE_RE,
  isSelfHandle,
  isValidHandle,
  normaliseHandle,
} from "../lib/social/handle";

/**
 * Regression tests for input handling, written after a real bug: a complete
 * pasted handle was stripped of its separators, not re-dashed because the
 * stripped length exceeded the threshold, and then reported to the user as
 * malformed. `AMZ-AZ1V-CDJG` is the handle that exposed it.
 */
describe("the handle shape", () => {
  it("accepts the canonical form", () => {
    expect(isValidHandle("AMZ-7K2P-9RTW")).toBe(true);
    expect(isValidHandle("AMZ-AZ1V-CDJG")).toBe(true);
  });

  it("is case-insensitive, because people retype it", () => {
    expect(isValidHandle("amz-7k2p-9rtw")).toBe(true);
    expect(HANDLE_RE.test("amz-7k2p-9rtw")).toBe(false); // the raw regex is not
  });

  it("rejects the ambiguous letters I, L, O and U", () => {
    for (const bad of ["IIOU", "ILOU"]) {
      expect(isValidHandle(`AMZ-${bad}-9RTW`)).toBe(false);
    }
    for (const letter of ["I", "L", "O", "U"]) {
      expect(HANDLE_ALPHABET).not.toContain(letter);
    }
  });

  it("rejects malformed shapes", () => {
    expect(isValidHandle("")).toBe(false);
    expect(isValidHandle("7K2P-9RTW")).toBe(false);
    expect(isValidHandle("AMZ-7K2P9RTW")).toBe(false);
    expect(isValidHandle("AMZ-7K2-9RTW")).toBe(false);
    expect(isValidHandle("AMZ-7K2P-9RTW-XXXX")).toBe(false);
    expect(isValidHandle(null)).toBe(false);
    expect(isValidHandle(undefined)).toBe(false);
  });
});

describe("normaliseHandle never mangles a valid handle", () => {
  it("returns a complete pasted handle UNCHANGED", () => {
    // The bug: this used to come back as AMZAZ1VCDJG and fail validation.
    expect(normaliseHandle("AMZ-AZ1V-CDJG")).toBe("AMZ-AZ1V-CDJG");
    expect(normaliseHandle("AMZ-7K2P-9RTW")).toBe("AMZ-7K2P-9RTW");
  });

  it("still uppercases a lowercase paste", () => {
    expect(normaliseHandle("amz-az1v-cdjg")).toBe("AMZ-AZ1V-CDJG");
  });

  it("rebuilds a handle from the bare eight characters", () => {
    expect(normaliseHandle("7K2P9RTW")).toBe("AMZ-7K2P-9RTW");
    expect(normaliseHandle("AZ1VCDJG")).toBe("AMZ-AZ1V-CDJG");
  });

  it("rebuilds from a prefix and loose separators", () => {
    expect(normaliseHandle("AMZ 7K2P 9RTW")).toBe("AMZ-7K2P-9RTW");
    expect(normaliseHandle("amz_7k2p_9rtw")).toBe("AMZ-7K2P-9RTW");
    expect(normaliseHandle("AMZ7K2P9RTW")).toBe("AMZ-7K2P-9RTW");
  });

  it("hands back what was typed when it cannot make a valid handle", () => {
    // So the error message describes the real input, not our mangling of it.
    expect(normaliseHandle("nope")).toBe("NOPE");
    expect(normaliseHandle("")).toBe("");
    expect(normaliseHandle("AMZ-7K2P-9RT")).toBe("AMZ-7K2P-9RT");
  });

  it("never invents characters to force a match", () => {
    for (const input of ["7K2P", "7K2P9RT", "7K2P9RTWX", "AMZ-7K2P-9RTW-EXTRA"]) {
      const out = normaliseHandle(input);
      if (out !== input.toUpperCase()) {
        // The only permitted transformation is a successful rebuild.
        expect(isValidHandle(out)).toBe(true);
      }
    }
  });
});

describe("isSelfHandle", () => {
  it("detects your own handle", () => {
    expect(isSelfHandle("AMZ-AZ1V-CDJG", "AMZ-AZ1V-CDJG")).toBe(true);
    expect(isSelfHandle("amz-az1v-cdjg", "AMZ-AZ1V-CDJG")).toBe(true);
    expect(isSelfHandle("AZ1VCDJG", "AMZ-AZ1V-CDJG")).toBe(true);
  });

  it("does not fire for someone else", () => {
    expect(isSelfHandle("AMZ-7K2P-9RTW", "AMZ-AZ1V-CDJG")).toBe(false);
  });

  it("does not fire when we have no handle yet", () => {
    // Otherwise an empty box would read as "that is your own handle".
    expect(isSelfHandle("", null)).toBe(false);
    expect(isSelfHandle("AMZ-AZ1V-CDJG", null)).toBe(false);
    expect(isSelfHandle("AMZ-AZ1V-CDJG", "")).toBe(false);
  });
});
