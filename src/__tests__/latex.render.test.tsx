/**
 * The qbank Latex wrapper's contract.
 *
 * It must match what react-latex-next did with its defaults (the reason
 * it exists is a KaTeX version unification, not a behavior change):
 * `$…$`/`\(…\)` inline, `$$…$$`/`\[…\]` display, plain text untouched,
 * and a TeX error falling back to the source instead of crashing the
 * question card.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Latex from "../components/custom/qbank/Latex";

function renderLatex(text: string) {
  const { container } = render(<Latex>{text}</Latex>);
  return container.querySelector(".__Latex__") as HTMLElement;
}

describe("Latex", () => {
  it("passes plain text through untouched", () => {
    const el = renderLatex("Newton's laws of motion, 2nd law: F = ma.");
    expect(el.textContent).toBe("Newton's laws of motion, 2nd law: F = ma.");
    expect(el.querySelector(".katex")).toBeNull();
  });

  it("renders $…$ as inline math", () => {
    const el = renderLatex("Energy $E=mc^2$ matters");
    expect(el.querySelector(".katex")).toBeTruthy();
    expect(el.querySelector(".katex-display")).toBeNull();
    expect(el.textContent).toContain("Energy");
    expect(el.textContent).toContain("matters");
  });

  it("renders \\(…\\) as inline math", () => {
    const el = renderLatex("inline \\(x^2\\) here");
    expect(el.querySelector(".katex")).toBeTruthy();
    expect(el.querySelector(".katex-display")).toBeNull();
  });

  it("renders $$…$$ as display math", () => {
    const el = renderLatex("$$\\frac{a}{b}$$");
    expect(el.querySelector(".katex-display")).toBeTruthy();
  });

  it("renders \\[…\\] as display math", () => {
    const el = renderLatex("\\[\\sqrt{2}\\]");
    expect(el.querySelector(".katex-display")).toBeTruthy();
  });

  it("shows the source when the math does not parse (strict: false)", () => {
    const el = renderLatex("bad $\\notacommand$ here");
    expect(el.querySelector(".katex")).toBeNull();
    expect(el.textContent).toContain("\\notacommand");
    expect(el.textContent).toContain("bad");
    expect(el.textContent).toContain("here");
  });

  it("leaves an unclosed delimiter as literal text", () => {
    const el = renderLatex("costs $5 today");
    expect(el.querySelector(".katex")).toBeNull();
    expect(el.textContent).toBe("costs $5 today");
  });

  it("treats an escaped dollar as content, not a delimiter", () => {
    const el = renderLatex("$a \\$ b$");
    expect(el.querySelector(".katex")).toBeTruthy();
    expect(el.textContent).toContain("$");
    expect(el.textContent).toContain("a");
    expect(el.textContent).toContain("b");
  });

  it("keeps a brace group from closing the delimiter early", () => {
    // findEndOfMath must track brace depth: the `$` inside the group is not
    // the closing delimiter, so the math run is the whole `\text{a $ b}`.
    // KaTeX rejects a bare `$` even in \text mode (it reserves `$`), so the
    // run falls back to source — and that source must be the FULL run. A
    // brace-tracking bug would truncate it at the inner `$`.
    const el = renderLatex("$\\text{a $ b}$ done");
    expect(el.querySelector(".katex")).toBeNull();
    expect(el.textContent).toBe("\\text{a $ b} done");
  });
});
