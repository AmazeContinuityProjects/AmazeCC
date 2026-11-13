// Creates the target docs/ tree from grounding/03-target-docs-structure.md with
// per-folder README.md stubs. Idempotent: existing files are never overwritten.
// Usage: node grounding/scaffold.mjs
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const structure = `docs/README.md
docs/00-web-foundation/README.md
docs/01-getting-started/README.md
docs/02-architecture/README.md
docs/03-routing/README.md
docs/04-app-shell/README.md
docs/05-attendance/README.md
docs/05-academics/README.md
docs/05-marks-predictor/README.md
docs/05-free-classrooms/README.md
docs/05-marks-and-cohort/README.md
docs/05-timetable-ui/README.md
docs/05-ffcs-planner/README.md
docs/05-ffcs-friends/README.md
docs/05-social/README.md
docs/05-friend-finder/README.md
docs/05-hostel/README.md
docs/05-libraries/README.md
docs/05-payments/README.md
docs/05-events-and-clubs/README.md
docs/05-cab-share/README.md
docs/05-tasks-and-pomodoro/README.md
docs/05-qbank/README.md
docs/05-paper-scanner/README.md
docs/05-student-report/README.md
docs/05-settings-and-profile/README.md
docs/05-notifications-and-push/README.md
docs/05-feedback-and-support/README.md
docs/05-changelog-and-about/README.md
docs/05-about-and-licensing/README.md
docs/05-onboarding/README.md
docs/05-guest-landing/README.md
docs/06-sync-engine/README.md
docs/07-data-layer/README.md
docs/08-pwa-platform/README.md
docs/09-testing/README.md
docs/10-tooling-and-ci/README.md
docs/11-security/README.md
docs/12-operations/README.md
docs/13-troubleshooting/README.md
docs/20-design-notes/README.md
docs/99-reference/README.md
docs/99-reference/decisions/README.md
docs/99-reference/academy/README.md
`;

const stubs = {
  "docs/README.md": `# AmazeCC — Developer Documentation\n\n> 🏗️ Handoff docs rebuild in progress. If you are a new developer: read this page, then \`00-web-foundation/\`, then \`01-getting-started/\`.\n`,
};

let created = 0;
for (const raw of structure.trim().split("\n")) {
  const path = raw.trim();
  if (!path) continue;
  const dir = path.slice(0, path.lastIndexOf("/"));
  if (dir) mkdirSync(dir, { recursive: true });
  if (existsSync(path)) continue;
  const title = path.split("/").filter(Boolean).slice(-2, -1)[0] ?? "docs";
  writeFileSync(
    path,
    stubs[path] ??
      `# ${title}\n\nContent lands in work packages WP-* per \`grounding/05-work-packages.md\`. Every page here follows \`grounding/04-writing-standard.md\`.\n`,
    "utf8",
  );
  created++;
}
console.log(`Created ${created} stub file(s).`);
