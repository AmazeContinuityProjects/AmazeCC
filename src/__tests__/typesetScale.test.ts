import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * TYPESET pass guard.
 *
 * DESIGN.md's six-step scale is 12 / 14 / 16 / 20 / 24 / 32px. The 9–11px
 * literals that remain in source are off-ramp steps and must be written with a
 * named step (`text-xs` for 12px). This guard is deliberately scoped to the
 * public/standalone surfaces and the shared layer owned by the typeset pass —
 * the dense app surfaces (timetable, exams, hostel, …) are owned elsewhere and
 * are not asserted here.
 *
 * The two `OptionPicker` label tokens in `uiTokens.ts` are a documented
 * exception: `selectField.test.tsx` pins their exact class string, and this
 * pass may not edit existing tests.
 */
function sourceFiles(target: string): string[] {
  const full = resolve(process.cwd(), target);
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(full, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const OWNED_DIRS = [
  "src/components/custom/app",
  "src/components/custom/landing",
  "src/components/custom/onboarding",
  "src/components/custom/feedback",
  "src/components/custom/shared",
  "src/components/ui",
];

const OWNED_FILES = [
  "src/lib/uiTokens.ts",
  "src/components/custom/FresherWelcomePage.tsx",
  "src/components/custom/NoContentFound.tsx",
  "src/components/custom/ThemeToggle.tsx",
  "src/app/not-found.tsx",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/page.tsx",
  "src/app/auth/callback/page.tsx",
  "src/app/~offline/page.tsx",
  "src/app/share/page.tsx",
  "src/app/share/ffcs/page.tsx",
];

const OFF_RAMP = /text-\[(?:9|9\.5|10|10\.5|11)px\]/;

describe("six-step type scale in the typeset-owned surfaces", () => {
  it("does not use 9–11px literal text sizes outside the documented exception", () => {
    const offenders = [...OWNED_DIRS.flatMap(sourceFiles), ...OWNED_FILES.map((f) => resolve(process.cwd(), f))]
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .map((text, index) => ({ file, line: index + 1, text: text.trim() })),
      )
      .filter(({ text }) => OFF_RAMP.test(text) && !text.startsWith("*") && !text.startsWith("//"))
      .filter(({ file, text }) => !(file.endsWith("uiTokens.ts") && text.includes("first-child_span]:text-[10px]")));

    expect(offenders.map(({ file, line, text }) => `${file}:${line} ${text}`)).toEqual([]);
  });
});
