// Generates docs/gitbook-docs.yaml from a JS object so the result is
// structurally guaranteed, then validates it against the GitBook schema rules.
// Usage: node grounding/gen-gitbook.mjs
import { writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const space = (key, title, path, dir, { default: def = false, hidden = false } = {}) => ({
  type: "space",
  key,
  title,
  path,
  ...(def ? { default: true } : {}),
  ...(hidden ? { hidden: true } : {}),
  content: { directory: `./${dir}` },
});
const section = (key, title, path, icon, def, children) => ({
  type: "section",
  key,
  title,
  path,
  icon,
  ...(def ? { default: true } : {}),
  children,
});

const site = {
  $schema: "https://api.gitbook.com/gitbook-docs.yaml",
  site: {
    title: "AmazeCC",
    structure: [
      section("section-start", "Getting Started", "start", "rocket", true, [
        space("space-web-foundation", "Web Foundation", "web-foundation", "00-web-foundation"),
        space("space-getting-started", "Getting Started", "getting-started", "01-getting-started", { default: true }),
        space("space-architecture", "Architecture", "architecture", "02-architecture"),
        space("space-routing", "Routing & Navigation", "routing", "03-routing"),
        space("space-app-shell", "App Shell", "app-shell", "04-app-shell"),
      ]),
      section("section-features", "Features", "features", "blocks", false, [
        space(
          "space-feature-about-and-licensing",
          "About & Licensing",
          "about-and-licensing",
          "05-about-and-licensing",
        ),
        space("space-feature-academics", "Academics", "academics", "05-academics"),
        space("space-feature-attendance", "Attendance", "attendance", "05-attendance"),
        space("space-feature-cab-share", "Cab Share", "cab-share", "05-cab-share"),
        space(
          "space-feature-changelog-and-about",
          "Changelog & About",
          "changelog-and-about",
          "05-changelog-and-about",
        ),
        space("space-feature-events-and-clubs", "Events & Clubs", "events-and-clubs", "05-events-and-clubs"),
        space(
          "space-feature-feedback-and-support",
          "Feedback & Support",
          "feedback-and-support",
          "05-feedback-and-support",
        ),
        space("space-feature-ffcs-friends", "FFCS Friends", "ffcs-friends", "05-ffcs-friends"),
        space("space-feature-ffcs-planner", "FFCS Planner", "ffcs-planner", "05-ffcs-planner", { default: true }),
        space("space-feature-free-classrooms", "Free Classrooms", "free-classrooms", "05-free-classrooms"),
        space("space-feature-friend-finder", "Friend Finder", "friend-finder", "05-friend-finder"),
        space("space-feature-guest-landing", "Guest Landing", "guest-landing", "05-guest-landing"),
        space("space-feature-hostel", "Hostel", "hostel", "05-hostel"),
        space("space-feature-libraries", "Libraries", "libraries", "05-libraries"),
        space("space-feature-marks-and-cohort", "Marks & Cohort", "marks-and-cohort", "05-marks-and-cohort"),
        space("space-feature-marks-predictor", "Marks Predictor", "marks-predictor", "05-marks-predictor"),
        space(
          "space-feature-notifications-and-push",
          "Notifications & Push",
          "notifications-and-push",
          "05-notifications-and-push",
        ),
        space("space-feature-onboarding", "Onboarding", "onboarding", "05-onboarding"),
        space("space-feature-paper-scanner", "Paper Scanner", "paper-scanner", "05-paper-scanner"),
        space("space-feature-payments", "Payments", "payments", "05-payments"),
        space("space-feature-qbank", "QBank", "qbank", "05-qbank"),
        space(
          "space-feature-settings-and-profile",
          "Settings & Profile",
          "settings-and-profile",
          "05-settings-and-profile",
        ),
        space("space-feature-social", "Social", "social", "05-social"),
        space("space-feature-student-report", "Student Report", "student-report", "05-student-report"),
        space("space-feature-tasks-and-pomodoro", "Tasks & Pomodoro", "tasks-and-pomodoro", "05-tasks-and-pomodoro"),
        space("space-feature-timetable-ui", "Timetable UI", "timetable-ui", "05-timetable-ui"),
      ]),
      section("section-systems", "Systems", "systems", "cpu", false, [
        space("space-sync-engine", "Sync Engine", "sync-engine", "06-sync-engine", { default: true }),
        space("space-data-layer", "Data Layer", "data-layer", "07-data-layer"),
        space("space-pwa-platform", "PWA Platform", "pwa-platform", "08-pwa-platform"),
        space("space-testing", "Testing", "testing", "09-testing"),
      ]),
      section("section-ops", "Operations", "ops", "wrench", false, [
        space("space-tooling-and-ci", "Tooling & CI", "tooling-and-ci", "10-tooling-and-ci"),
        space("space-security", "Security", "security", "11-security"),
        space("space-operations", "Operations", "operations", "12-operations", { default: true }),
        space("space-troubleshooting", "Troubleshooting", "troubleshooting", "13-troubleshooting"),
      ]),
      section("section-reference", "Reference", "reference", "book", false, [
        space("space-reference", "Reference", "handbook", "99-reference", { default: true }),
        space("space-design-notes", "Design Notes", "design-notes", "20-design-notes"),
        space("space-contributing", "Contributing", "contributing", "contributing"),
        space("space-archive", "Archive (historical)", "archive", "archive", { hidden: true }),
      ]),
    ],
  },
};

// ---------- validation (Git Sync-import rules) ----------
const ALLOWED = {
  section: [
    "type",
    "key",
    "title",
    "localizedTitle",
    "description",
    "localizedDescription",
    "icon",
    "default",
    "path",
    "condition",
    "children",
  ],
  "section-group": ["type", "key", "title", "localizedTitle", "icon", "condition", "draft", "children"],
  space: ["type", "key", "title", "localizedTitle", "path", "default", "hidden", "draft", "condition", "content"],
  "external-link": [
    "type",
    "key",
    "title",
    "localizedTitle",
    "description",
    "localizedDescription",
    "icon",
    "url",
    "draft",
    "condition",
  ],
};

const errors = [];
const keys = new Set();
const paths = new Set();
function checkNode(node, depth, parentTypes) {
  const { type, key, title, path } = node;
  for (const k of Object.keys(node)) {
    if (!ALLOWED[type]?.includes(k)) errors.push(`${type} ${key}: unexpected property ${k}`);
  }
  if (keys.has(key)) errors.push(`duplicate key: ${key}`);
  keys.add(key);
  if (path && paths.has(path)) errors.push(`duplicate path: ${path}`);
  if (path) paths.add(path);
  if (type === "section") {
    const defs = node.children.filter((c) => c.default).length;
    if (defs !== 1) errors.push(`section ${key}: ${defs} default spaces (must be exactly 1)`);
    if (!node.children.every((c) => c.type === "space")) errors.push(`section ${key}: non-space child`);
  } else if (type === "space") {
    if (!node.path || !node.title || !node.content?.directory)
      errors.push(`space ${key}: missing title/path/content.directory`);
    const dir = node.content.directory.replace(/^\.\//, "");
    if (!existsSync(join("docs", dir)) || !statSync(join("docs", dir)).isDirectory())
      errors.push(`space ${key}: content.directory missing: docs/${dir}`);
  }
  for (const c of node.children ?? []) checkNode(c, depth + 1, [...parentTypes, type]);
}
const sectionCount = site.site.structure.filter((n) => n.type === "section").length;
const topSpaces = site.site.structure.filter((n) => n.type === "space").length;
const defaultSections = site.site.structure.filter((n) => n.type === "section" && n.default).length;
if (sectionCount > 0 && topSpaces > 0) errors.push("top-level spaces alongside sections are not allowed");
if (defaultSections !== 1) errors.push(`exactly one default section required (found ${defaultSections})`);
site.site.structure.forEach((n) => checkNode(n, 0, []));

if (errors.length) {
  console.error("VALIDATION FAILED:");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

// ---------- YAML emitter (minimal, JSON-scalar-safe) ----------
const q = (s) =>
  /^[a-z0-9 _.\/&-]+$/i.test(s) && !/^\d+$/.test(s) && s !== "true" && s !== "false" ? s : JSON.stringify(s);
function dump(v, indent = 0) {
  const pad = "  ".repeat(indent);
  if (Array.isArray(v)) {
    return v.map((item) => pad + "- " + dump(item, indent + 1).trimStart()).join("\n");
  }
  if (v && typeof v === "object") {
    return Object.entries(v)
      .map(([k, val]) => {
        if (val === null || typeof val === "boolean" || typeof val === "number") return `${pad}${k}: ${String(val)}`;
        if (typeof val !== "object") return `${pad}${k}: ${q(String(val))}`;
        const inner = dump(val, indent + 1);
        return `${pad}${k}:\n${inner}`;
      })
      .join("\n");
  }
  return `${pad}${q(String(v))}`;
}
const yaml = dump(site) + "\n";
writeFileSync("docs/gitbook-docs.yaml", yaml, "utf8");
console.log(`wrote docs/gitbook-docs.yaml (${yaml.split("\n").length} lines)`);
console.log("validation: OK");
