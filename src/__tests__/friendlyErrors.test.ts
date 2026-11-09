import { describe, expect, it } from "vitest";
import { classifyAuthFailure, friendlyErrorMessage } from "../lib/sync-engine/errors";

const RAW = [
  "Invalid Username / Password",
  "Invalid Captcha",
  "Too many requests. Try again later.",
  "Please visit VTOP and change your password, it has expired after the usual 3 month period",
  "VTOP portal unreachable (vtopcc.vit.ac.in is down)",
  "VTOP login phase exceeded 50000ms",
  "TypeError: Failed to fetch",
  "Not logged in — add your VTOP credentials first.",
  "Internal server error",
];

describe("friendlyErrorMessage", () => {
  it("rewrites every known failure", () => {
    for (const raw of RAW) expect(friendlyErrorMessage(raw)).not.toBe(raw);
  });

  it("keeps unknown messages as they are", () => {
    expect(friendlyErrorMessage("Marks parser returned no rows")).toBe("Marks parser returned no rows");
  });

  it("never returns an empty message", () => {
    expect(friendlyErrorMessage("")).toMatch(/went wrong/);
    expect(friendlyErrorMessage(undefined)).toMatch(/went wrong/);
  });

  it("classifies sign-in failures the same before and after rewriting", () => {
    for (const raw of RAW) {
      expect(classifyAuthFailure(friendlyErrorMessage(raw)), raw).toBe(classifyAuthFailure(raw));
    }
  });

  it("keeps the words the outage detectors look for", () => {
    expect(friendlyErrorMessage("VTOP portal unreachable (vtopcc.vit.ac.in is down)")).toMatch(/vtop.*down/i);
    expect(friendlyErrorMessage("TypeError: Failed to fetch")).toMatch(/couldn't reach AmazeCC/i);
  });

  it("says what to do for the common ones", () => {
    expect(friendlyErrorMessage("Invalid Username / Password")).toMatch(/password is wrong/);
    expect(friendlyErrorMessage("Please visit VTOP and change your password, it has expired")).toMatch(/expired/);
  });
});

describe("friendlyErrorWithDetail", () => {
  it("keeps the raw message for diagnostics", async () => {
    const { friendlyErrorWithDetail } = await import("../lib/sync-engine/errors");
    expect(friendlyErrorWithDetail("HTTP 500")).toMatch(/server hit an error.*\(HTTP 500\)$/);
    expect(friendlyErrorWithDetail("Marks parser returned no rows")).toBe("Marks parser returned no rows");
  });
});
