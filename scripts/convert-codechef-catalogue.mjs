#!/usr/bin/env node
/**
 * Convert CodeChef VIT's FFCS-inator course catalogue into the bundled,
 * fully-offline CSV AmazeCC ships at public/ffcs/codechef-vit-catalogue.csv.
 *
 * Data source: FFCS-inator by CodeChef VIT — https://ffcs.codechefvit.com
 * Repository:  https://github.com/CodeChefVIT/ffcs (local clone expected as a
 *              sibling of this repo: ../ffcs/src/data, overridable via argv[2])
 * License:     MIT © 2025 CodeChef-VIT. The output CSV carries the same
 *              provenance; see public/ffcs/codechef-vit-catalogue.SOURCE.md.
 *
 * The source data is plain TypeScript object literals of the shape
 *   'CODE - Title': [{ slot, venue, faculty }, ...]
 * possibly nested several levels deep (school -> category -> courses) and
 * cross-importing each other. Each file is transpiled with the installed
 * `typescript` package and evaluated in a `node:vm` sandbox with a small
 * CommonJS resolver, then every course-shaped key at any depth is harvested.
 *
 * The emitted CSV uses exactly the header the planner's report loader already
 * accepts (CODE,TITLE,TYPE,CREDITS,SLOT,FACULTY,VENUE) plus EMPLOYEE SCHOOL,
 * so no client code besides the report registry needs to change. The output is
 * deterministic: same input produces identical bytes.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const ts = createRequire(import.meta.url)("typescript");

const sourceDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(import.meta.dirname, "../../ffcs/src/data");
const outputPath = path.resolve(import.meta.dirname, "../public/ffcs/codechef-vit-catalogue.csv");

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  console.error("Pass the CodeChef data directory as the first argument, e.g.");
  console.error("  node scripts/convert-codechef-catalogue.mjs ../ffcs/src/data");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Module loading: transpile each .ts file to CommonJS and evaluate it in a vm
// sandbox with a require() that resolves the relative imports these files use.
// ---------------------------------------------------------------------------

/** Resolved-path -> module cache. Pre-seeded before evaluation so import
 * cycles receive the partially-filled exports object, like Node's own loader. */
const moduleCache = new Map();

function resolveSpecifier(fromFile, spec) {
  if (!spec.startsWith(".")) {
    throw new Error(`${fromFile}: unsupported non-relative import '${spec}'`);
  }
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [`${base}.ts`, base, `${path.join(base, "index.ts")}`, `${path.join(base, "index.js")}`];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`${fromFile}: cannot resolve import '${spec}'`);
}

function loadModule(file) {
  const cached = moduleCache.get(file);
  if (cached) return cached.exports;

  const source = fs.readFileSync(file, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  });

  const mod = { exports: {} };
  moduleCache.set(file, mod); // before running, so cycles see these exports

  const require_ = (spec) => loadModule(resolveSpecifier(file, spec));
  const wrapper = vm.runInNewContext(
    `(function (exports, require, module, __filename, __dirname) {\n${outputText}\n})`,
    { console },
    { filename: file },
  );
  wrapper(mod.exports, require_, mod, file, path.dirname(file));
  return mod.exports;
}

// ---------------------------------------------------------------------------
// Source walk
// ---------------------------------------------------------------------------

/** "CODE - Title" -> everything before the first " - " is the course code. */
const COURSE_KEY = /^(\S+) - (.+)$/;

/** Collapse internal whitespace so 'CHITRA  D' and 'CHITRA D' dedupe as one
 * offering — parseReportRows applies the same normalization at load time. */
const cleanField = (value) => String(value).replace(/\s+/g, " ").trim();

/** A course entry is valid when slot and faculty are non-empty strings;
 * venue may be empty (some MTech entries use the literal 'NIL' instead). */
function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const { slot, venue, faculty } = entry;
  if (typeof slot !== "string" || !slot.trim()) return null;
  if (typeof faculty !== "string" || !faculty.trim()) return null;
  return {
    slot: cleanField(slot),
    faculty: cleanField(faculty),
    venue: typeof venue === "string" ? cleanField(venue) : "",
  };
}

const stats = {
  schoolFolders: 0,
  sourceFiles: 0,
  rawRows: 0,
  malformed: [],
  dedupedRows: 0,
  mixedSlotRows: 0,
  perSchool: new Map(),
  credits: { winter: 0, previous: 0, heuristicLab: 0, heuristicTheory: 0 },
};

function harvest(value, school, rows) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const element of value) harvest(element, school, rows);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const match = COURSE_KEY.exec(key);
    if (match && Array.isArray(child)) {
      const [, code, title] = match;
      for (const raw of child) {
        const entry = normalizeEntry(raw);
        if (!entry) {
          stats.malformed.push(`${school}: '${key}' has a malformed entry ${JSON.stringify(raw)}`);
          continue;
        }
        stats.rawRows += 1;
        rows.push({
          CODE: cleanField(code),
          TITLE: cleanField(title),
          SLOT: entry.slot,
          FACULTY: entry.faculty,
          VENUE: entry.venue,
          SCHOOL: school,
        });
      }
    } else if (child && typeof child === "object") {
      // Nested category maps can themselves match the course-key shape
      // ('ProgrammeCore - MIC'), so anything that is not an array of
      // offerings is a namespace and gets walked instead of rejected.
      harvest(child, school, rows);
    }
  }
}

function listTsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listTsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

const rawRows = [];
for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
  if (!entry.isDirectory()) continue; // root-level faculty.ts/faq.ts aggregate the folders
  stats.schoolFolders += 1;
  const files = listTsFiles(path.join(sourceDir, entry.name));
  stats.sourceFiles += files.length;
  for (const file of files) {
    harvest(loadModule(file), entry.name, rawRows);
  }
}

// ---------------------------------------------------------------------------
// TYPE + CREDITS derivation
// ---------------------------------------------------------------------------

/** Lab only when every part of the slot string is a lab slot ("L15+L16").
 * A slot mixing theory and lab parts ("A1+L15") is classified TH — matching
 * the previous report's vocabulary — and counted in the summary. */
function classifyType(slot) {
  const parts = slot
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const labParts = parts.filter((part) => /^L\d/.test(part));
  const isLab = parts.length > 0 && labParts.length === parts.length;
  const isMixed = labParts.length > 0 && labParts.length < parts.length;
  return { type: isLab ? "LO" : "TH", mixed: isMixed };
}

/** Minimal RFC-4180 reader for the two bundled reports we join credits from. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += char;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Credits lookup keyed by exact course code. Both bundled reports place SLOT
 * at index 4, and a theory course and its lab can share one code with
 * different credit values (e.g. BAMAT101 = 3 for D1+TD1, 1 for L11+L12), so
 * each report row is classified with the same slot rule above and stored per
 * (code, TYPE). The winter report wins over the previous report; within a
 * report the first row wins. Rows whose code has no usable entry fall back to
 * lab = 1, theory = 3 — the two dominant classes in the reports.
 */
function buildCreditsLookup(file, codeIndex, creditsIndex, lookup, source) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  for (const row of rows.slice(1)) {
    const code = (row[codeIndex] ?? "").trim();
    const credits = (row[creditsIndex] ?? "").trim();
    if (!code || !credits) continue;
    const { type } = classifyType((row[4] ?? "").trim());
    let byType = lookup.get(code);
    if (!byType) {
      byType = {};
      lookup.set(code, byType);
    }
    if (byType[type] === undefined) {
      byType[type] = { credits, source };
    }
  }
}

const creditsLookup = new Map();
const ffcsRoot = path.resolve(import.meta.dirname, "../public/ffcs");
buildCreditsLookup(path.join(ffcsRoot, "winter-2026-2027-slot-timetable.csv"), 0, 2, creditsLookup, "winter");
buildCreditsLookup(path.join(ffcsRoot, "ffcsReport.csv"), 0, 3, creditsLookup, "previous");

function creditsFor(code, type) {
  const byType = creditsLookup.get(code);
  if (byType) {
    // Exact (code, TYPE) match first; fall back to the other type's value only
    // when the code was recorded under one type alone (unambiguous).
    if (byType[type]) return byType[type];
    const keys = Object.keys(byType);
    if (keys.length === 1) return byType[keys[0]];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dedupe, derive, sort, emit
// ---------------------------------------------------------------------------

const deduped = new Map();
for (const row of rawRows) {
  const key = `${row.CODE}\u0000${row.TITLE}\u0000${row.SLOT}\u0000${row.FACULTY}\u0000${row.VENUE}`;
  if (deduped.has(key)) continue; // different school folders list some courses twice
  deduped.set(key, row);
}

const rows = [];
for (const row of deduped.values()) {
  const { type, mixed } = classifyType(row.SLOT);
  if (mixed) stats.mixedSlotRows += 1;
  const joined = creditsFor(row.CODE, type);
  let credits;
  if (joined) {
    credits = joined.credits;
    stats.credits[joined.source] += 1;
  } else {
    credits = type === "LO" ? "1" : "3";
    stats.credits[type === "LO" ? "heuristicLab" : "heuristicTheory"] += 1;
  }
  rows.push({ ...row, TYPE: type, CREDITS: credits });
  stats.perSchool.set(row.SCHOOL, (stats.perSchool.get(row.SCHOOL) ?? 0) + 1);
}
stats.dedupedRows = rows.length;

/** Code-unit comparison — deliberately not localeCompare, which depends on the
 * host's ICU data and would break byte-for-byte determinism. */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
rows.sort(
  (a, b) =>
    cmp(a.CODE, b.CODE) ||
    cmp(a.SLOT, b.SLOT) ||
    cmp(a.FACULTY, b.FACULTY) ||
    cmp(a.VENUE, b.VENUE) ||
    cmp(a.SCHOOL, b.SCHOOL),
);

function csvField(value) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const header = "CODE,TITLE,TYPE,CREDITS,SLOT,FACULTY,VENUE,EMPLOYEE SCHOOL";
const lines = [header];
for (const row of rows) {
  lines.push(
    [row.CODE, row.TITLE, row.TYPE, row.CREDITS, row.SLOT, row.FACULTY, row.VENUE, row.SCHOOL].map(csvField).join(","),
  );
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf8");

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const distinctCodes = new Set(rows.map((row) => row.CODE)).size;
console.log(`CodeChef VIT catalogue conversion — ${sourceDir}`);
console.log("");
console.log(`  school folders      ${stats.schoolFolders}`);
console.log(`  source .ts files    ${stats.sourceFiles}`);
console.log(`  raw offering rows   ${stats.rawRows}`);
console.log(`  malformed skipped   ${stats.malformed.length}`);
console.log(`  deduped rows        ${stats.dedupedRows}`);
console.log(`  distinct codes      ${distinctCodes}`);
console.log(`  mixed slot rows     ${stats.mixedSlotRows} (classified TH)`);
console.log("");
console.log("  credits source            rows");
console.log(`  winter report join        ${stats.credits.winter}`);
console.log(`  previous report join      ${stats.credits.previous}`);
console.log(`  heuristic (theory = 3)    ${stats.credits.heuristicTheory}`);
console.log(`  heuristic (lab = 1)       ${stats.credits.heuristicLab}`);
console.log("");
console.log("  rows per school folder");
for (const [school, count] of [...stats.perSchool.entries()].sort((a, b) => cmp(a[0], b[0]))) {
  console.log(`    ${school.padEnd(16)} ${count}`);
}
console.log("");
console.log(`  wrote ${outputPath}`);

if (stats.malformed.length > 0) {
  console.log("");
  console.log(`  WARNING: skipped ${stats.malformed.length} malformed entries:`);
  for (const message of stats.malformed.slice(0, 10)) console.log(`    - ${message}`);
  if (stats.malformed.length > 10) console.log(`    ... and ${stats.malformed.length - 10} more`);
}
