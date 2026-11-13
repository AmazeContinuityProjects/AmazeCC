import { readFileSync, writeFileSync } from "node:fs";
const fixes = [
  [
    "docs/05-ffcs-planner/notes/clash-detection-and-schema.md",
    [
      [
        "../../../src/components/custom/exams/FFCS/logic/generate.ts",
        "../../../src/components/custom/exams/FFCS/logic/generator.ts",
      ],
    ],
  ],
  [
    "docs/05-ffcs-planner/notes/timetable-export-and-reviews.md",
    [["../../../src/components/custom/timetable/buildBands.ts", "../../../src/lib/buildBands.ts"]],
  ],
  [
    "docs/archive/friend-finder-plans/00-overview.md",
    [
      ["../05-friend-finder/design-note.md", "../../05-friend-finder/design-note.md"],
      ["../05-ffcs-planner/notes/README.md", "../../05-ffcs-planner/notes/README.md"],
    ],
  ],
  [
    "docs/archive/friend-finder-plans/README.md",
    [["../05-friend-finder/design-note.md", "../../05-friend-finder/design-note.md"]],
  ],
];
for (const [file, list] of fixes) {
  let c = readFileSync(file, "utf8");
  for (const [find, replace] of list) c = c.replaceAll(find, replace);
  writeFileSync(file, c, "utf8");
}
console.log("done");
