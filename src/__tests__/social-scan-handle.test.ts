/**
 * What counts as a scannable peer handle.
 *
 * The camera decodes whatever QR is in front of it, so the gate between "a QR"
 * and "a peer's handle" is the only thing standing between a wifi password and
 * a pairing form. `normaliseHandle` + `isValidHandle` is that gate, and these
 * pin the decisions the scanner relies on.
 */

import { describe, it, expect } from "vitest";
import { isValidHandle, normaliseHandle } from "@/lib/social/handle";

/** What ScanHandleSheet does with a decoded string. */
function acceptDecoded(decoded: string): string | null {
  // The trim lives at the scanner boundary, because normaliseHandle is
  // deliberately non-destructive.
  const candidate = normaliseHandle(decoded.trim());
  return isValidHandle(candidate) ? candidate : null;
}

describe("a scanned QR is only accepted when it is a handle", () => {
  it("takes the handle straight off a peer's Share QR", () => {
    // ShareHandleSheet renders QRCodeSVG with the bare handle as its value.
    expect(acceptDecoded("AMZ-7K2P-9RTW")).toBe("AMZ-7K2P-9RTW");
  });

  it("survives a scanner that returns the value with stray whitespace", () => {
    expect(acceptDecoded("  AMZ-7K2P-9RTW\n")).toBe("AMZ-7K2P-9RTW");
  });

  it("refuses the unrelated QRs a camera will actually see", () => {
    // Not an exhaustive list, just the plausible ones in a room full of people
    // comparing handles.
    for (const junk of [
      "WIFI:T:WPA;S: hostel-guest;P:hunter2;;",
      "https://upi.example/pay?pa=someone@bank",
      "BEGIN:VCARD\nVERSION:3.0\nFN:Someone\nEND:VCARD",
      "otpauth://totp/AmazeCC:someone",
      "",
      "   ",
    ]) {
      expect(`${junk.slice(0, 16)}:${acceptDecoded(junk)}`).toBe(`${junk.slice(0, 16)}:null`);
    }
  });

  it("refuses a near-miss that a human would call correct", () => {
    // One character off, and an ambiguous letter where the alphabet excludes
    // it. Both are the mistake this gate exists to catch.
    expect(acceptDecoded("AMZ-7K2P-9RT")).toBeNull();
    expect(acceptDecoded("AMZ-7K2P-9RTW")).toBe("AMZ-7K2P-9RTW");
    expect(acceptDecoded("AMZ-7I2P-9RTW")).toBeNull();
  });

  it("does not invent characters to force a match", () => {
    // normaliseHandle is deliberately conservative: given something it cannot
    // make valid it hands back exactly what it was given rather than guessing,
    // so a bad scan can never become a different real student's handle.
    const decoded = "AMZ-7K2P-9RTWX";
    expect(normaliseHandle(decoded)).toBe(decoded);
    expect(acceptDecoded(decoded)).toBeNull();
  });
});
