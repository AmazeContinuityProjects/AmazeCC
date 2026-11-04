// Post-export step (runs via `pnpm build`, right after `next build --webpack`):
// Serwist inlines the full precache manifest into `out/sw.js` as
// `precacheEntries:([...])??[]` (single-quoted JS object literals). That
// manifest still lists every lazy JS chunk — ~4.6MB the first visit never
// asks for. This script rewrites the inlined manifest to keep only chunks
// referenced by eagerly served HTML, so a fresh install downloads the shell
// instead of the whole bundle graph. Excluded-on-purpose images/data are
// filtered later at SW install time by src/app/sw.ts; this script only
// handles chunks (the prune set depends on the build's HTML, so it can't
// live in source). Fails the build loudly if any step can't be verified.
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const outDir = path.join(projectRoot, "out");
const swPath = path.join(outDir, "sw.js");

const MANIFEST_PATTERN = /precacheEntries:\((\[.*?\])\?\?\[\]\)/s;

function walk(dir, suffix, found = []) {
  for (const name of fs.readdirSync(dir)) {
    const entry = path.join(dir, name);
    if (fs.statSync(entry).isDirectory()) {
      walk(entry, suffix, found);
    } else if (name.endsWith(suffix)) {
      found.push(entry);
    }
  }
  return found;
}

function collectEagerChunkRefs() {
  const eager = new Set();
  for (const file of walk(outDir, ".html")) {
    const html = fs.readFileSync(file, "utf8");
    // <script src>/<link href> references…
    for (const [, ref] of html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)) {
      eager.add(ref.split("?")[0]);
    }
    // …plus raw paths inside inline scripts (the RSC flight payload names
    // chunks without a src/href attribute around them).
    for (const [ref] of html.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9_/.-]+\.js/g)) {
      eager.add(ref);
    }
  }
  return eager;
}

function main() {
  if (!fs.existsSync(swPath)) {
    console.error(`prune-sw-precache: ${swPath} not found — run "next build" first.`);
    process.exit(1);
  }

  const source = fs.readFileSync(swPath, "utf8");
  const match = source.match(MANIFEST_PATTERN);
  if (!match) {
    console.error("prune-sw-precache: precache manifest not found in out/sw.js — Serwist output changed.");
    process.exit(1);
  }

  let entries;
  try {
    entries = JSON.parse(match[1].replace(/'/g, '"'));
  } catch (error) {
    console.error("prune-sw-precache: could not parse precache manifest:", error.message);
    process.exit(1);
  }
  if (entries.length === 0) {
    console.error("prune-sw-precache: precache manifest is empty — refusing to rewrite.");
    process.exit(1);
  }

  const eager = collectEagerChunkRefs();
  if (eager.size === 0) {
    console.error("prune-sw-precache: no chunk references found in out/**/*.html — refusing to prune.");
    process.exit(1);
  }

  const isLazyChunk = (url) => /^\/_next\/static\/chunks\/.+\.js$/.test(url) && !eager.has(url);
  const sizeOf = (url) => {
    try {
      return fs.statSync(path.join(outDir, url)).size;
    } catch {
      return 0;
    }
  };

  const kept = entries.filter((entry) => !isLazyChunk(typeof entry === "string" ? entry : entry.url));
  const prunedEntries = entries.filter((entry) => isLazyChunk(typeof entry === "string" ? entry : entry.url));
  const prunedBytes = prunedEntries.reduce(
    (sum, entry) => sum + sizeOf(typeof entry === "string" ? entry : entry.url),
    0,
  );

  // Function replacer: JSON output may contain `$` sequences that a string
  // replacement would interpret as substitution patterns.
  const rewritten = source.replace(match[0], () => `precacheEntries:(${JSON.stringify(kept)}??[])`);
  fs.writeFileSync(swPath, rewritten);

  console.log(
    `prune-sw-precache: ${entries.length} → ${kept.length} entries ` +
      `(${prunedEntries.length} lazy chunks, ${(prunedBytes / 1024 / 1024).toFixed(2)}MB; eager refs kept: ${eager.size})`,
  );
}

main();
