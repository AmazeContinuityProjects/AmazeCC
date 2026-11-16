// One-off: strip the 4th "icon" argument from every space(...) call, add a strict
// properties-per-node-type validator, and rewrite generator accordingly.
import { readFileSync, writeFileSync } from "node:fs";

const SPACE_ICONS = [
  "book-open",
  "rocket",
  "layers",
  "route",
  "layout-dashboard",
  "blocks",
  "graduation-cap",
  "calendar-check",
  "car",
  "history",
  "calendar-star",
  "message-circle",
  "users",
  "table-2",
  "door-open",
  "search-check",
  "home",
  "bed-double",
  "book-marked",
  "chart-scatter",
  "chart-line",
  "bell",
  "sparkles",
  "scan-line",
  "wallet",
  "file-question",
  "user-cog",
  "link-2",
  "file-text",
  "check-square",
  "grid",
  "scale",
  "refresh-cw",
  "database",
  "smartphone",
  "flask-conical",
  "hammer",
  "shield",
  "server",
  "life-buoy",
  "book",
  "pen-tool",
  "archive",
];

let c = readFileSync("grounding/gen-gitbook.mjs", "utf8");
const list = SPACE_ICONS.map((i) => i.replace(/-/g, "\\-"));
const iconArg = new RegExp(`, "(${list.join("|")})"(?=\\s*(\\)|, \\{))`, "g");
const before = (c.match(new RegExp(iconArg, "g")) ?? []).length;
c = c.replace(iconArg, "");

// add strict per-type property whitelist inside the validation loop
const anchor = "function checkNode(node, depth, parentTypes) {";
const inject = `const ALLOWED = {
  section: ["type", "key", "title", "localizedTitle", "description", "localizedDescription", "icon", "default", "path", "condition", "children"],
  "section-group": ["type", "key", "title", "localizedTitle", "icon", "condition", "draft", "children"],
  space: ["type", "key", "title", "localizedTitle", "path", "default", "hidden", "draft", "condition", "content"],
  "external-link": ["type", "key", "title", "localizedTitle", "description", "localizedDescription", "icon", "url", "draft", "condition"],
};
`;
if (!c.includes("const ALLOWED")) {
  c = c.replace(
    "// ---------- validation (Git Sync-import rules) ----------",
    "// ---------- validation (Git Sync-import rules) ----------\n" + inject,
  );
}
const propCheck = `  const { type, key, title, path } = node;
  for (const k of Object.keys(node)) {
    if (!ALLOWED[type]?.includes(k)) errors.push(\`\${type} \${key}: unexpected property \${k}\`);
  }
`;
c = c.replace("  const { type, key, title, path } = node;\n", propCheck);
writeFileSync("grounding/gen-gitbook.mjs", c, "utf8");
console.log("removed icon args from spaces; validator whitelist added");
