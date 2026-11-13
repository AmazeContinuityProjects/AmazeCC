import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const edits = [
  // file → [ [find, replace], ... ]
  [
    "docs/contributing/pull-request-guide.md",
    [
      ["[Conventional Commits](#commit-messages)", "[Conventional Commits](../99-reference/glossary.md)"],
      ["![before](url)", "`before` (screenshot placeholder)"],
      ["![after](url)", "`after` (screenshot placeholder)"],
    ],
  ],
];

// all archive/api files: fix ../overview.md + stale security/architecture links
for (const f of readdirSync("docs/archive/api")) {
  const path = `docs/archive/api/${f}`;
  let c = readFileSync(path, "utf8");
  c = c.replaceAll("](../overview.md)", "](overview.md)");
  c = c.replaceAll(
    "](../../architecture/backend.md#data-fetching-flow)",
    "](../../06-sync-engine/14-api-route-contracts.md)",
  );
  c = c.replaceAll("](../../security/api-security.md)", "](../../11-security/README.md)");
  c = c.replaceAll("](../../security/overview.md)", "](../../11-security/README.md)");
  writeFileSync(path, c, "utf8");
}

// friend-finder plan notes
for (const f of ["docs/archive/friend-finder-plans/00-overview.md", "docs/archive/friend-finder-plans/README.md"]) {
  let c = readFileSync(f, "utf8");
  c = c.replaceAll("../ffcs-friend-finder/README.md", "../05-friend-finder/design-note.md");
  c = c.replaceAll("../ffcs-workings/README.md", "../05-ffcs-planner/notes/README.md");
  writeFileSync(f, c, "utf8");
}

// FFCSketch comparison absolute path
{
  const f = "docs/archive/FFCSketch-Comparison/README.md";
  let c = readFileSync(f, "utf8");
  c = c.replace(/\(file:\/\/\/home\/sugeethjsa\/GitHub\/AmazeCC\)/g, "(../../)");
  writeFileSync(f, c, "utf8");
}

// FFCS planner notes: absolute-path links → repo-relative
for (const f of readdirSync("docs/05-ffcs-planner/notes")) {
  const path = `docs/05-ffcs-planner/notes/${f}`;
  let c = readFileSync(path, "utf8");
  c = c.replaceAll("file:///C:/Users/sugee/Github/AmazeContinuityProjects/AmazeCC/", "../../../");
  writeFileSync(path, c, "utf8");
}

for (const [file, list] of edits) {
  let c = readFileSync(file, "utf8");
  for (const [find, replace] of list) c = c.replaceAll(find, replace);
  writeFileSync(file, c, "utf8");
}
console.log("fixes applied");
