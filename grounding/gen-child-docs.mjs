// Generates docs/docs.json for the AmazeCC repo (the "child" in Mintlify's
// multirepo setup). Every docs/*.md becomes a page; each folder index.md is its
// group root. Groups are nested inside section headers so the sidebar reads as
// one section per area (Start here / Features / Systems / Operations /
// Reference / Archive). Idempotent and safe to re-run.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DOCS = "docs";

// Section headers for the sidebar; each section's `keys` list the folder order.
const SECTIONS = [
  {
    group: "Start here",
    icon: "rocket",
    expanded: true,
    keys: ["00-web-foundation", "01-getting-started", "02-architecture", "03-routing", "04-app-shell"],
  },
  {
    group: "Features",
    icon: "sparkles",
    expanded: true,
    keys: [
      "05-ffcs-planner",
      "05-attendance",
      "05-academics",
      "05-marks-predictor",
      "05-free-classrooms",
      "05-marks-and-cohort",
      "05-timetable-ui",
      "05-ffcs-friends",
      "05-social",
      "05-friend-finder",
      "05-hostel",
      "05-libraries",
      "05-payments",
      "05-events-and-clubs",
      "05-cab-share",
      "05-tasks-and-pomodoro",
      "05-qbank",
      "05-paper-scanner",
      "05-student-report",
      "05-settings-and-profile",
      "05-notifications-and-push",
      "05-feedback-and-support",
      "05-changelog-and-about",
      "05-about-and-licensing",
      "05-onboarding",
      "05-guest-landing",
    ],
  },
  {
    group: "Systems",
    icon: "server",
    expanded: true,
    keys: ["06-sync-engine", "07-data-layer", "08-pwa-platform", "09-testing"],
  },
  {
    group: "Operations",
    icon: "wrench",
    expanded: true,
    keys: ["10-tooling-and-ci", "11-security", "12-operations", "13-troubleshooting"],
  },
  {
    group: "Reference",
    icon: "book-open",
    expanded: true,
    keys: ["20-design-notes", "99-reference", "contributing"],
  },
  {
    group: "Archive",
    icon: "archive",
    expanded: false,
    keys: ["archive"],
  },
];
const TITLES = {
  "00-web-foundation": "Web Foundation",
  "01-getting-started": "Getting Started",
  "02-architecture": "Architecture",
  "03-routing": "Routing & Navigation",
  "04-app-shell": "App Shell",
  "05-ffcs-planner": "FFCS Planner",
  "05-attendance": "Attendance",
  "05-academics": "Academics",
  "05-marks-predictor": "Marks Predictor",
  "05-free-classrooms": "Free Classrooms",
  "05-marks-and-cohort": "Marks & Cohort Stats",
  "05-timetable-ui": "Timetable UI",
  "05-ffcs-friends": "FFCS Friends",
  "05-social": "Social",
  "05-friend-finder": "Friend Finder",
  "05-hostel": "Hostel",
  "05-libraries": "Libraries",
  "05-payments": "Payments",
  "05-events-and-clubs": "Events & Clubs",
  "05-cab-share": "Cab Share",
  "05-tasks-and-pomodoro": "Tasks & Pomodoro",
  "05-qbank": "QBank",
  "05-paper-scanner": "Paper Scanner",
  "05-student-report": "Student Report",
  "05-settings-and-profile": "Settings & Profile",
  "05-notifications-and-push": "Notifications & Push",
  "05-feedback-and-support": "Feedback & Support",
  "05-changelog-and-about": "Changelog & About",
  "05-about-and-licensing": "About & Licensing",
  "05-onboarding": "Onboarding",
  "05-guest-landing": "Guest Landing",
  "06-sync-engine": "Sync Engine",
  "07-data-layer": "Data Layer",
  "08-pwa-platform": "PWA Platform",
  "09-testing": "Testing",
  "10-tooling-and-ci": "Tooling & CI",
  "11-security": "Security",
  "12-operations": "Production Runbook",
  "13-troubleshooting": "Troubleshooting",
  "20-design-notes": "Design Notes",
  "99-reference": "Reference",
  contributing: "Contributing",
  archive: "Archive (historical)",
};

function walk(dir, depth = 0) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, depth + 1));
    else if (/\.(md|mdx)$/i.test(e.name))
      out.push(
        relative(DOCS, p)
          .split(sep)
          .join("/")
          .replace(/\.(md|mdx)$/i, ""),
      );
  }
  return out;
}

const buildGroup = (key) => {
  const dir = join(DOCS, key);
  try {
    if (!statSync(dir).isDirectory()) return null;
  } catch {
    return null;
  }
  const pages = walk(dir).sort();
  const root = pages.find((p) => p === `${key}/index`);
  if (!root && pages.length === 0) return null;
  const rest = pages.filter((p) => p !== root);
  return {
    group: TITLES[key] ?? key,
    ...(root ? { root } : {}),
    pages: rest,
  };
};

const groups = [];
for (const section of SECTIONS) {
  const children = section.keys.map(buildGroup).filter(Boolean);
  if (children.length === 0) continue;
  groups.push({
    group: section.group,
    icon: section.icon,
    expanded: section.expanded,
    pages: children,
  });
}

const doc = {
  $schema: "https://mintlify.com/docs.json",
  name: "AmazeCC Documentation",
  navigation: { groups },
};
writeFileSync(join(DOCS, "docs.json"), JSON.stringify(doc, null, 2) + "\n", "utf8");
const count = groups.reduce((n, g) => n + g.pages.reduce((m, sub) => m + sub.pages.length + (sub.root ? 1 : 0), 0), 0);
console.log(`wrote docs/docs.json - ${groups.length} sections, ${count} pages`);
