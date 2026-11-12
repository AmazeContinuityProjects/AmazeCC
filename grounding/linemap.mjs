import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const folders = [
  "attendance",
  "exams",
  "exams/marks-predictor",
  "mobile",
  "friendfinder",
  "social",
  "hostel",
  "libraries",
  "events",
  "hostel/CabShare",
  "tasks",
  "qbank",
  "tools/scanner",
  "reports",
  "header",
  "feedback",
  "onboarding",
  "landing",
  "more",
];
const counts = [];
for (const f of folders) {
  const dir = join("src/components/custom", f);
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (statSync(p).isDirectory()) {
          for (const nested of readdirSync(p)) {
            const np = join(p, nested);
            if (/\.(tsx|ts)$/.test(nested)) counts.push([rel(np), lines(np)]);
          }
        }
        continue;
      }
      if (/\.(tsx|ts)$/.test(entry.name)) counts.push([rel(p), lines(p)]);
    }
  } catch {}
}
function rel(p) {
  return p.split(sep).join("/");
}
function lines(p) {
  return readFileSync(p, "utf8").split("\n").length;
}
counts.sort((a, b) => b[1] - a[1]);
for (const [name, n] of counts.slice(0, 80)) console.log(`${n}\t${name}`);
