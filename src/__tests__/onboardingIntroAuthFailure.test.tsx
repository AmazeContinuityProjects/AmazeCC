import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Rejected sign-in on the first-run intro.
 *
 * The intro's loader screen is where the first login now happens, so it has to
 * carry the same advice the sync sheet does when VTOP says no. The classifier
 * lives in the sync engine (`classifyAuthFailure`); this pins the two outcomes
 * the student can act on:
 *
 * - VTOP named the password as wrong → offer the credential editor inline.
 * - A captcha / rate limit / bare "login failed" → only VTOP can clear it, so
 *   send the student there instead of pretending a new password here helps.
 *
 * Anything else (a timeout, a dropped connection) is *not* a sign-in failure
 * and must not be dressed up as one.
 */

const session = vi.hoisted(() => ({
  current: {
    open: false,
    title: "",
    lines: [] as { text: string; status: string }[],
    progress: 0,
    runId: 0,
    outcome: null as string | null,
    notice: null,
    presentation: "sheet",
  },
}));

const unicc = vi.hoisted(() => ({ available: false, target: "amazecc" }));

vi.mock("@/store", () => ({ isLoggedInAtom: Symbol("isLoggedInAtom") }));

vi.mock("jotai", () => ({
  useAtomValue: () => false,
}));

vi.mock("@/lib/sync-engine/sync-session", () => ({
  useSyncSession: () => session.current,
}));

vi.mock("@/lib/useUniccTarget", () => ({
  useUniccTarget: () => unicc.target,
  setUniccTarget: () => {},
  isUniccFallbackEnabled: () => unicc.available,
}));

vi.mock("@/lib/fetch-utils", () => ({
  getActiveApiUrl: () => "https://primary.example",
  setActiveApiUrl: () => {},
  PRIMARY_API_URL: "https://primary.example",
  BACKUP_API_URL: "https://backup.example",
  hasBackupApi: () => true,
}));

vi.mock("@/lib/unicc-fallback", () => ({ UNICC_API_URL: "https://unicc.example" }));

vi.mock("../components/custom/shared/primitives/SelectField", () => ({
  default: () => <div data-testid="server-select" />,
}));

import OnboardingIntro from "../components/custom/onboarding/OnboardingIntro";

function failWith(text: string) {
  session.current = {
    open: false,
    title: "Full Sync",
    lines: [
      { text: "Verifying VTOP credentials…", status: "loading" },
      { text, status: "error" },
    ],
    progress: 0,
    runId: 3,
    outcome: "error",
    notice: null,
    presentation: "inline",
  };
}

function renderIntro(onChangePassword = vi.fn()) {
  return render(
    <OnboardingIntro
      initialPhase="login"
      login={{
        username: "VITUSER12345",
        password: "hunter2",
        setUsername: () => {},
        setPassword: () => {},
        onSignIn: async () => false,
        error: session.current.lines.find((l) => l.status === "error")?.text ?? null,
        onChangePassword,
      }}
      onDone={() => {}}
    />
  );
}

beforeEach(() => {
  unicc.available = false;
  unicc.target = "amazecc";
});

afterEach(() => {
  cleanup();
});

describe("intro sign-in rejection", () => {
  it("offers the credential editor when VTOP names the password as wrong", () => {
    failWith("Invalid Username / Password");
    const onChangePassword = vi.fn();
    renderIntro(onChangePassword);

    expect(screen.getByText("Check your password")).toBeTruthy();
    expect(screen.getByText(/don't match/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(onChangePassword).toHaveBeenCalledTimes(1);

    // A reset on VTOP itself is offered alongside, because only VTOP can undo
    // a password changed there.
    const reset = screen.getByRole("link", { name: /reset on vtop/i });
    expect(reset.getAttribute("href")).toBe("https://vtopcc.vit.ac.in");
  });

  it("sends the student to VTOP for a captcha or rate limit, with no inline fix", () => {
    failWith("Too many failed login attempts, try again later");
    const onChangePassword = vi.fn();
    renderIntro(onChangePassword);

    expect(screen.getByText("Sign-in rejected")).toBeTruthy();
    expect(screen.getByRole("link", { name: /change password on vtop/i })).toBeTruthy();

    // A new password here cannot clear a rate limit, so offering one would be
    // a dead end that also burns another login attempt.
    expect(screen.queryByRole("button", { name: /change password/i })).toBeNull();
    expect(onChangePassword).not.toHaveBeenCalled();
  });

  it("keeps a plain error line for failures that are not about signing in", () => {
    failWith("Login timed out (server took too long), check your connection and try again");

    renderIntro();

    expect(screen.queryByText("Check your password")).toBeNull();
    expect(screen.queryByText("Sign-in rejected")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Login timed out");
  });
});
