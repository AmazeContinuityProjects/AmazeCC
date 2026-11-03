/**
 * Inline LaTeX for qbank question text.
 *
 * Replaces `react-latex-next`, which inlines its own KaTeX (0.16.10)
 * inside its dist bundle — a second, invisible copy of the library that
 * no dependency update could ever reach, so it could not receive the
 * 0.18.2 prototype-pollution fix. This renders with the app's own
 * `katex` dependency instead, which means the JS and the
 * `katex.min.css` stylesheet are always the same version: swapping the
 * CSS alone would orphan the markup (0.18 renamed `strut`, `base`,
 * `accent`, …), so the bump and this swap land together.
 *
 * Behavior is a faithful port of what react-latex-next did with its
 * defaults: split at `$…$`, `$$…$$`, `\(…\)`, `\[…\]` (longest first),
 * render each math run with `katex.renderToString`, and on a TeX error
 * fall back to showing the source verbatim — its `strict: false`
 * default. The splitting itself is ported from KaTeX's
 * `contrib/auto-render/splitAtDelimiters.js` (MIT, © Khan Academy),
 * the same source react-latex-next adapted.
 */

import katex from "katex";

type Delimiter = { left: string; right: string; display: boolean };

type Fragment = { type: "text"; data: string } | { type: "math"; data: string; display: boolean };

const DELIMITERS: Delimiter[] = [
  // `$$` must precede `$` so the regex alternation prefers the longer run.
  { left: "$$", right: "$$", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "$", right: "$", display: false },
  { left: "\\[", right: "\\]", display: true },
];

/** Ported from KaTeX auto-render (MIT, © Khan Academy). */
function findEndOfMath(delimiterValue: string, text: string, startIndex: number): number {
  let index = startIndex;
  let braceLevel = 0;
  const delimLength = delimiterValue.length;
  while (index < text.length) {
    const character = text[index];
    if (braceLevel <= 0 && text.slice(index, index + delimLength) === delimiterValue) {
      return index;
    } else if (character === "\\") {
      index++;
    } else if (character === "{") {
      braceLevel++;
    } else if (character === "}") {
      braceLevel--;
    }
    index++;
  }
  return -1;
}

function escapeRegex(text: string): string {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/** Ported from KaTeX auto-render (MIT, © Khan Academy). */
function splitAtDelimiters(text: string, delimiters: Delimiter[]): Fragment[] {
  const data: Fragment[] = [];
  const regexLeft = new RegExp("(" + delimiters.map((delim) => escapeRegex(delim.left)).join("|") + ")");
  let rest = text;
  for (;;) {
    const index = rest.search(regexLeft);
    if (index === -1) break;
    if (index > 0) {
      data.push({ type: "text", data: rest.slice(0, index) });
      rest = rest.slice(index); // rest now starts with a delimiter
    }
    const delim = delimiters.find((d) => rest.startsWith(d.left))!;
    const end = findEndOfMath(delim.right, rest, delim.left.length);
    if (end === -1) break;
    data.push({ type: "math", data: rest.slice(delim.left.length, end), display: delim.display });
    rest = rest.slice(end + delim.right.length);
  }
  if (rest !== "") data.push({ type: "text", data: rest });
  return data;
}

/** Renders text + math runs to an HTML string (react-latex-next's path). */
function renderToHtml(text: string): string {
  return splitAtDelimiters(text, DELIMITERS)
    .map((fragment) => {
      if (fragment.type === "text") return fragment.data;
      try {
        return katex.renderToString(fragment.data, { displayMode: fragment.display });
      } catch {
        // strict: false — a TeX error shows the source instead of crashing
        // the question card.
        return fragment.data;
      }
    })
    .join("");
}

export default function Latex({ children }: { children: string }) {
  return <span className="__Latex__" dangerouslySetInnerHTML={{ __html: renderToHtml(children) }} />;
}
