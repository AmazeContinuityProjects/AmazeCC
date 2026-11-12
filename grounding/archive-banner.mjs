// Prepends the archive banner to every markdown file under docs/archive/ that lacks it.
// Usage: node grounding/archive-banner.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "docs/archive";
const banner =
  "> ⚠️ **ARCHIVED — historical context, not authoritative.**\n" +
  "> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe\n" +
  "> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.\n" +
  "> See `docs/README.md` for current documentation.\n\n";

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

let updated = 0;
for (const file of walk(root)) {
  const content = readFileSync(file, "utf8");
  if (content.includes("ARCHIVED — historical context")) continue;
  writeFileSync(file, banner + content, "utf8");
  updated++;
}
console.log(`Updated ${updated} file(s) with the archive banner.`);
