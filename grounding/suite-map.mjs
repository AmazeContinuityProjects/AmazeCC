// Generates docs/09-testing/07-suite-map.md from the test files in the repo.
// Descriptions: curated for the important suites; generic fallback otherwise.
import { readdirSync, writeFileSync } from "node:fs";

const dir = "src/__tests__";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.ts") || f.endsWith(".test.tsx"))
  .sort();

const curated = {
  "sync-modes.test.ts": "presets (quick/balanced/full/…) expand, validate, resolve reload modes",
  "sync-session.test.ts": "sync sheet lines, progress, close/retry lifecycle",
  "sync-engine-autologin.test.ts": "login flow captcha→session→op path",
  "credential-manager.test.ts": "session restore, single-flight refresh, backoff/lockout",
  "single-sync.test.ts": "runPageSync open→run→close lifecycle",
  "syncTimes.test.ts": "sync timing log recording + failure bookmark",
  "marksSync.test.ts": "assessment key parity, frozen receipts, consent flow",
  "marksStatsOp.test.ts": "class stats op merge/absent behavior",
  "unicc-fallback.test.ts": "allowlist paths only; password never sent on failure",
  "unicc-fallback-callsite.test.ts": "call-site allowlist enforcement",
  "workerBase.test.ts": "worker routes allowed/blocked + failover exclusions",
  "fetch-utils.test.ts": "failoverBackupUrl, primary/backup SWAP rules",
  "fetch-utils-backup-api.test.ts": "backup host never serves UniCC",
  "credentialVault.test.ts": "AES-GCM encrypt→decrypt roundtrip; migration of plaintext",
  "chunkRecovery.test.ts": "stale-chunk detect → purge+reload once per 10s",
  "csp.test.ts": "CSP meta contains every required directive",
  "calendarDay.test.ts": "calendar classification model (working/instructional/CAT days) ~1.7k lines",
  "marksPredictor.test.ts": "absolute & relative grade ladder math",
  "gradeBoundaries.test.ts": "boundary tables & letter assignment",
  "gradesEffective.test.ts": "CGPA cumulative computation",
  "ffcs-generate.test.ts": "timetable search: clash-free, deterministic, sheet caps",
  "ffcs-generate.facultyPriority.test.ts": "faculty priority ordering effects",
  "ffcs-generate-stream.test.ts": "batched worker protocol (one-shot + stream)",
  "ffcsGenerationRun.dropLadder.test.ts": "drop ladder: when we drop and how it's reported",
  "ffcsShare.test.ts": "share-link round-trip: compress→decode→same week",
  "ffcsShareInput.test.ts": "parsing raw short codes into plans",
  "ffcsSettings.test.ts": "settings sanitize/restore/defaults",
  "ffcs-embedded.test.ts": "embedded CSVs parse to valid ParsedCourse rows",
  "ffcsCodechefCatalogue.test.ts": "catalogue CSV integrity vs CodeChef-VIT source",
  "ffcsClassmates.test.ts": "ffcs-match call shape + error handling",
  "ffcsClassmates.render.test.tsx": "friend picker UI behavior",
  "ffcsTab.render.test.tsx": "planner tab mounts; routes to guided/modern",
  "ffcsGeneratorTargets.test.ts": "generator target lock semantics",
  "exportTimetable.test.ts": "export artifact shapes (html/json/unsafe strings)",
  "exportClashReport.test.ts": "clash report content invariants",
  "timetable-vertical.test.tsx": "vertical grid rendering rules",
  "timetable-vertical.render.test.tsx": "render of mobile timetable",
  "timetable-horizontal-law.test.tsx": "horizontal layout invariants",
  "timetable-metrics.test.ts": "timetable density metrics sorting",
  "social-sync-op.test.ts": "social op shape & ordering",
  "scannerPipeline.test.ts": "end-to-end OCR pipeline fixtures",
  "storage.test.ts": "storage.ts typed accessors + quota handling",
  "forgetDevice.test.ts": "forget-credentials wipe behavior",
  "overlayStack.test.tsx": "push/pop ordering; dead-entry pruning",
  "a11yClickable.test.tsx": "clickable non-button elements fire like buttons",
  "serviceWorker.test.ts": "sw.ts cache policy structure (precache exclusions)",
  "worker-artifact.test.ts": "sw.js artifact integrity",
  "single-sync.test.ts": "runPageSync lifecycle",
  "analytics.test.ts": "GA consent-gated queue",
  "posthog.test.ts": "client config identity hash, turn detection",
  "studentReportPdf.test.tsx": "report PDF structure/layout asserts",
  "homeEntryController.test.tsx": "guest vs app gate logic",
  "signInReturn.test.ts": "return path round-trip through sign-in",
  "weekStrip.test.tsx": "week strip rendering",
  "onboardingSimplified.test.tsx": "simplified home onboarding",
};

const groups = {};
for (const f of files) {
  const name = f.replace(/\.test\.tsx?$/, "");
  const prefix = name.split(/[-.]/)[0];
  groups[prefix] = groups[prefix] ?? [];
  groups[prefix].push({ f, desc: curated[f] ?? "" });
}

let out = `# 07 — Suite Map (all ${files.length} test files)\n\n> One line per suite, grouped by family. Regenerate with \`node grounding/suite-map.mjs\`.\n> Run a family: \`pnpm run test -- <family>\` (filename substring).\n\n`;
for (const [k, list] of Object.entries(groups).sort()) {
  out += `## \`${k}*\` (${list.length})\n\n`;
  for (const { f, desc } of list) out += `- \`${f}\` — ${desc || "_(scenario pins — see file)_"}\n`;
  out += "\n";
}
writeFileSync("docs/09-testing/07-suite-map.md", out, "utf8");
console.log(`wrote suite map with ${files.length} entries`);
