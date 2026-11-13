// Regenerates the GENERATED-LIST portion of grounding/09-coverage-checklist.md.
// Usage: node grounding/generate-checklist.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const rel = (p) => relative(ROOT, p).split(sep).join("/");
const lines = [];

function walk(dir, filter) {
  const out = [];
  if (!statSync(dir, { throwIfNoEntry: false })) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, filter));
    else if (!filter || filter(entry.name)) out.push(rel(p));
  }
  return out;
}

function section(title, items) {
  lines.push("");
  lines.push(`## ${title}`);
  lines.push("");
  for (const i of items.sort()) lines.push(`- [ ] ${i}`);
}

const srcTs = (n) => /\.(ts|tsx|css)$/.test(n);
section(
  "1 — Root configuration & meta",
  readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(json|mjs|yaml|yml|rc|cjs)$/.test(e.name) && !/lock/i.test(e.name))
    .map((e) => e.name)
    .concat(["CNAME", ".npmrc", ".prettierrc", ".prettierignore", ".husky/"]),
);
section("2 — Build/deploy pipelines & editor config", [
  ...walk(".github/workflows"),
  "vitest.config.ts",
  "eslint.config.mjs",
  "pnpm-workspace.yaml",
]);
section(
  "3 — src/app routes & boundaries",
  walk("src/app", (n) => !/\.ico$/.test(n)),
);
section("4 — src/components", walk("src/components", srcTs));
section("5 — src/lib", walk("src/lib", srcTs));
section("6 — src/store atoms", walk("src/store", srcTs));
section("7 — src/features & src/types", [...walk("src/features", srcTs), ...walk("src/types")]);
section("8 — src/data fixtures", walk("src/data"));
section("9 — src/__tests__ suites", walk("src/__tests__", srcTs));
section("10 — scripts/ tooling", walk("scripts"));

const file = "grounding/09-coverage-checklist.md";
const original = readFileSync(file, "utf8");
const generated = lines.join("\n");
const marker = "<!--GENERATED-LIST-->";
if (!original.includes(marker)) {
  console.error(`Marker ${marker} not found — is the file already partially filled?`);
  process.exit(1);
}
writeFileSync(file, original.replace(marker, generated.trim()), "utf8");
console.log(`Wrote ${generated.split("\n").length} generated lines into ${file}`);
