// Overwrites stub README.md files created by the scaffold with proper feature indexes.
import { writeFileSync } from "node:fs";

const R = {
  academics: ["Academics", "marks, grade history, curriculum, exam schedule, CGPA"],
  "marks-predictor": ["Marks Predictor", "what-if ladders, absolute & relative grading"],
  "free-classrooms": ["Free Classrooms", "find an empty room right now (on-device)"],
  "marks-and-cohort": ["Marks & Cohort", "anonymized class statistics (opt-in)"],
  "timetable-ui": ["Timetable UI", "every timetable grid in the app"],
};

for (const [k, [t, tag]] of Object.entries(R)) {
  const p = `docs/05-${k}/README.md`;
  writeFileSync(
    p,
    `# 05 — ${t}\n\n> **In one line:** ${tag}.\n\n- [overview.md](overview.md) · [architecture.md](architecture.md) · [data-model.md](data-model.md)\n- [ui-map.md](ui-map.md) · [storage-and-state.md](storage-and-state.md) · [testing.md](testing.md)\n- [known-issues.md](known-issues.md) · [history.md](history.md)\n\nSource anchor: see the paths inside each page (mostly \`src/components/custom/…\`, \`src/lib/…\`).\n`,
    "utf8",
  );
}
console.log("done");
