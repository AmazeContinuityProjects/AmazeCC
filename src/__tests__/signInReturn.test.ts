import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSignInReturn,
  isAllowedReturnPath,
  peekSignInReturn,
  prepareSignIn,
  takeSignInReturn,
} from "../lib/signInReturn";

describe("signInReturn", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("only allows same-origin planner paths", () => {
    expect(isAllowedReturnPath("/ffcs")).toBe(true);
    expect(isAllowedReturnPath("/ffcs/?open=classmates")).toBe(true);
    expect(isAllowedReturnPath("/ffcs?open=classmates")).toBe(true);
    expect(isAllowedReturnPath("/friend-finder")).toBe(true);
    expect(isAllowedReturnPath("/friend-finder/disclaimer")).toBe(true);
    expect(isAllowedReturnPath("/ffcsevil")).toBe(false);
    expect(isAllowedReturnPath("//evil.com/ffcs")).toBe(false);
    expect(isAllowedReturnPath("https://evil.com/ffcs")).toBe(false);
    expect(isAllowedReturnPath("/\\evil.com")).toBe(false);
    expect(isAllowedReturnPath("/settings")).toBe(false);
    expect(isAllowedReturnPath(42)).toBe(false);
  });

  it("returns the login URL and remembers the way back once", () => {
    expect(prepareSignIn("/ffcs/?open=classmates")).toBe("/?signin=1");
    expect(takeSignInReturn()).toBe("/ffcs/?open=classmates");
    expect(takeSignInReturn()).toBeNull();
  });

  it("does not remember a disallowed path", () => {
    expect(prepareSignIn("//evil.com")).toBe("/?signin=1");
    expect(takeSignInReturn()).toBeNull();
  });

  it("forgets the way back after 30 minutes", () => {
    prepareSignIn("/ffcs");
    expect(takeSignInReturn(Date.now() + 31 * 60 * 1000)).toBeNull();
  });

  it("ignores a tampered note", () => {
    window.sessionStorage.setItem("amaze_signin_return", JSON.stringify({ path: "//evil.com", at: Date.now() }));
    expect(takeSignInReturn()).toBeNull();
    window.sessionStorage.setItem("amaze_signin_return", "not json");
    expect(takeSignInReturn()).toBeNull();
  });

  it("peeks without clearing, so the return can wait for a fresh login", () => {
    const before = Date.now();
    prepareSignIn("/ffcs/?open=classmates");
    const note = peekSignInReturn();
    expect(note?.path).toBe("/ffcs/?open=classmates");
    expect(note!.at).toBeGreaterThanOrEqual(before);
    expect(peekSignInReturn()?.path).toBe("/ffcs/?open=classmates");
    clearSignInReturn();
    expect(peekSignInReturn()).toBeNull();
  });

  it("drops an expired note when peeking", () => {
    prepareSignIn("/ffcs");
    expect(peekSignInReturn(Date.now() + 31 * 60 * 1000)).toBeNull();
    expect(window.sessionStorage.getItem("amaze_signin_return")).toBeNull();
  });
});
