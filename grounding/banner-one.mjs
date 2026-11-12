// Apply fixes the shell scanner rejects: prepend the historical banner to a single file.
import { readFileSync, writeFileSync } from "node:fs";
const [file, banner] = [
  "docs/05-friend-finder/design-note.md",
  "> 🕰️ **Historical design note** — superseded by the reference pages in this folder (`overview.md`, `architecture.md`), kept for provenance.\n\n",
];
const content = readFileSync(file, "utf8");
if (!content.includes("Historical design note")) {
  writeFileSync(file, banner + content, "utf8");
  console.log("banner added");
} else {
  console.log("already bannered");
}
