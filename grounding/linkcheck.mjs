// Relative-link checker for docs/ (and grounding/ optionally).
// Usage: node grounding/linkcheck.mjs [root]
// Checks every markdown link that is not http(s):, mailto:, or a pure #anchor.
// Verifies existence of target path (case-insensitively) and, when an anchor is given,
// that some heading in the target file produces that anchor (GitHub kebab rules).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";

const root = process.argv[2] ?? "docs";
const problems = [];
let checked = 0;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function headingAnchors(content) {
  const anchors = new Set();
  for (const m of content.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
    const text = m[1]
      .trim()
      .toLowerCase()
      .replace(/[`*_~]/g, "")
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .replace(/\s+/g, "-");
    anchors.add(text);
  }
  return anchors;
}

function existsCaseInsensitive(p) {
  if (existsSync(p)) return true;
  try {
    const dir = dirname(p);
    const target = p.split(/[\\/]/).pop().toLowerCase();
    return readdirSync(dir).some((n) => n.toLowerCase() === target);
  } catch {
    return false;
  }
}

for (const file of walk(root)) {
  const content = readFileSync(file, "utf8");
  for (const m of content.matchAll(LINK_RE)) {
    const raw = m[1];
    if (/^(https?:|mailto:|tel:)/.test(raw)) continue;
    checked++;
    const [pathPart, anchorPart] = raw.split("#");
    if (!pathPart && anchorPart) {
      if (!headingAnchors(content).has(anchorPart.toLowerCase())) {
        problems.push(`${file}: anchor #${anchorPart} not found in this file`);
      }
      continue;
    }
    const target = resolve(dirname(file), decodeURIComponent(pathPart));
    if (!existsCaseInsensitive(target)) {
      problems.push(`${file}: broken link -> ${pathPart}`);
      continue;
    }
    if (anchorPart) {
      try {
        const tc = readFileSync(target, "utf8");
        if (!headingAnchors(tc).has(anchorPart.toLowerCase())) {
          problems.push(`${file}: anchor #${anchorPart} not found in ${pathPart}`);
        }
      } catch {
        /* non-md target: anchor can't be verified */
      }
    }
  }
}

console.log(`checked ${checked} link(s) under ${root}/`);
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(" - " + p);
  process.exitCode = 1;
} else {
  console.log("no broken links or anchors found ✓");
}
