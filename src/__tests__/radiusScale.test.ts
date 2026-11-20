import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * DESIGN.md permits exactly six radius steps: 8 / 12 / 16 / 24 / 28 / 32px.
 * The three largest are written as `rounded-[24px]` / `rounded-[28px]` /
 * `rounded-[32px]` on purpose — Tailwind's `rounded-3xl` is also 24px, so
 * keeping both spellings defeats the grep-based drift check the scale relies
 * on. Source is normalised to the named step, and this guard keeps the
 * duplicate spelling (and the off-scale 18/22px values) from returning.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("named radius scale", () => {
  const offScale = /rounded-(?:3xl|\[18px\]|\[22px\])/;

  it("does not use duplicate or off-scale radius steps in source", () => {
    const offenders = sourceFiles(resolve(process.cwd(), "src"))
      .filter((file) => !file.includes("__tests__"))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .map((text, index) => ({ file, line: index + 1, text: text.trim() }))
          .filter(({ text }) => offScale.test(text) && !text.startsWith("*") && !text.startsWith("//")),
      );
    expect(offenders.map(({ file, line, text }) => `${file}:${line} ${text}`)).toEqual([]);
  });
});
