// Overwrites scaffold stubs with proper feature READMEs for batch 2 folders.
import { writeFileSync } from "node:fs";

const R = {
  "ffcs-friends": ["FFCS Friends", "match your planner timetable to friends who registered the same sections"],
  social: ["Social", "pairing, groups, common free hours"],
  "friend-finder": ["Friend Finder", "public route with VTOP-verified login modal"],
  hostel: ["Hostel", "mess, laundry, leave, counselling, cab-share"],
  libraries: ["Libraries", "catalog search + patron account via Koha"],
  payments: ["Payments", "VIT fee dues, receipts, wallet"],
  "events-and-clubs": ["Events & Clubs", "EventHub registration + club directory + feed"],
  "cab-share": ["Cab Share", "ride-sharing for hostellers (opt-in)"],
  "tasks-and-pomodoro": ["Tasks & Pomodoro", "task board + pomodoro timer + Moodle import"],
};

for (const [k, [t, tag]] of Object.entries(R)) {
  const p = `docs/05-${k}/README.md`;
  writeFileSync(
    p,
    `# 05 — ${t}\n\n> **In one line:** ${tag}.\n\n- [overview.md](overview.md) · [architecture.md](architecture.md) · [data-model.md](data-model.md)\n- [ui-map.md](ui-map.md) · [storage-and-state.md](storage-and-state.md) · [testing.md](testing.md)\n- [known-issues.md](known-issues.md) · [history.md](history.md)\n\nSource anchor: see the paths inside each page.\n`,
    "utf8",
  );
}
console.log("done");
