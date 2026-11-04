#!/usr/bin/env node
/**
 * Build `scripts/scanner-nn-dataset.jsonl` — real exam-paper text for the
 * scanner's neural net — from the public papers.codechefvit.com catalogue.
 *
 *   node scripts/build-scanner-dataset.mjs [--target 40] [--max-codes 120]
 *                                          [--per-subject 2] [--ocr-pages 3]
 *                                          [--dpi 200]
 *
 * The catalogue holds both kinds of paper, and both belong in the corpus:
 *
 *   • digital PDFs → the text layer, via `pdftotext` (poppler).
 *   • scanned PDFs → pages rendered with `pdftoppm`, then OCR'd with
 *     tesseract.js — the *same engine the app runs at inference time*. That
 *     matters: a camera scan comes out as noisy text ("pnpece3ic", stray
 *     pipes), so the model has to recognise an exam header *through* OCR
 *     noise, not only on clean text.
 *
 * Deterministic sampling (seeded shuffle, same seed family as the trainer),
 * though the live catalogue itself may shift between runs. Existing rows are
 * kept and new ones appended until `--target`, so re-running is incremental
 * and hand-written rows in the file survive.
 *
 * Needs network, poppler (`pdftotext`/`pdftoppm`) and the app's tesseract.js
 * dependency. If OCR fails to start, digital-only extraction continues with a
 * loud warning rather than failing the whole run.
 *
 * Writes one JSON object per line: {"text", "label": "exam", "source", "method"}.
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetOut = path.join(root, "scripts/scanner-nn-dataset.jsonl");

const CODES_URL =
  "https://raw.githubusercontent.com/CodeChefVIT/papers-codechef/staging/src/data/slot_to_subjects.json";
const papersApi = (code) => `https://www.papers.codechefvit.com/api/papers?subject=${code}`;

const SEED = 20261104; // same seed family as train-scanner-nn.mjs
const MIN_CHARS = 600; // a paper shorter than this after normalising is noise
const MAX_CHARS = 4000; // truncate so one sample cannot dominate the vector
const MAX_BYTES = 15 * 1024 * 1024;
const LABEL = "exam"; // the catalogue's exam enum is CAT-1/CAT-2/FAT/Model only

/* ----------------------------------------------------------------- args */

function flag(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  if (!Number.isFinite(v) || v <= 0) {
    console.error(`dataset: ${name} expects a positive number, got "${process.argv[i + 1]}"`);
    process.exit(2);
  }
  return Math.floor(v);
}

const TARGET = flag("--target", 40);
const MAX_CODES = flag("--max-codes", 120);
const PER_SUBJECT = flag("--per-subject", 2);
const OCR_PAGES = flag("--ocr-pages", 3);
const DPI = flag("--dpi", 200);

/* ------------------------------------------------------------------ rng */

/** mulberry32 — identical across runs for a fixed seed (mirrors the trainer). */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(SEED);
const shuffle = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/* --------------------------------------------------------------- text */

/**
 * Printable ASCII + newlines only. OCR hands back smart quotes, stray glyphs
 * and form feeds; the feature extractor scores letters/digits/spaces, so junk
 * characters would only add variance without adding signal.
 */
function normalize(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[^\x20-\x7e\n\t]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const hash = (text) => crypto.createHash("sha1").update(text).digest("hex");

/* ------------------------------------------------------- pdf extraction */

function pdfToText(file) {
  try {
    return execFileSync("pdftotext", ["-enc", "UTF-8", file, "-"], {
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
      timeout: 60_000,
    }).toString("utf8");
  } catch {
    return "";
  }
}

/** One shared OCR worker — engine init + language data are the expensive part. */
let ocrWorker = null;
let ocrBroken = false;

async function getOcr() {
  if (ocrBroken) return null;
  if (ocrWorker) return ocrWorker;
  try {
    const { createWorker } = await import("tesseract.js");
    ocrWorker = await createWorker("eng");
    return ocrWorker;
  } catch (err) {
    ocrBroken = true;
    console.warn(`dataset: OCR unavailable (${err.message}) — digital papers only`);
    return null;
  }
}

async function ocrPages(file, pages) {
  const worker = await getOcr();
  if (!worker) return "";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scandata-"));
  try {
    execFileSync("pdftoppm", ["-png", "-r", String(DPI), "-f", "1", "-l", String(pages), file, path.join(dir, "pg")], {
      stdio: "ignore",
      timeout: 120_000,
    });
    const pngs = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".png"))
      .sort();
    const parts = [];
    for (const png of pngs) {
      const { data } = await worker.recognize(path.join(dir, png));
      parts.push(data.text ?? "");
    }
    return parts.join("\n");
  } catch {
    return "";
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------- network */

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error(`too large (${len} bytes)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`too large (${buf.length} bytes)`);
  fs.writeFileSync(dest, buf);
}

/* --------------------------------------------------------------- main */

async function main() {
  console.log(
    `dataset: target ${TARGET} samples · ${MAX_CODES} codes · ${PER_SUBJECT}/subject · OCR ${OCR_PAGES}p @${DPI}dpi`,
  );

  // 1. Subject codes from the catalogue's own slot map.
  const slotMap = await getJson(CODES_URL);
  const codes = new Set();
  for (const v of Object.values(slotMap)) {
    const entries = Array.isArray(v) ? v : v && typeof v === "object" ? Object.keys(v) : [];
    for (const s of entries) {
      const m = String(s).match(/\[([A-Z0-9]+)\]/);
      if (m) codes.add(m[1]);
    }
  }
  const orderedCodes = shuffle([...codes]).slice(0, MAX_CODES);
  console.log(`dataset: ${codes.size} subject codes, sampling ${orderedCodes.length}`);

  // 2. Existing rows count toward the target; their text and source URLs are
  //    deduped against. The file is rewritten with only the valid rows, so a
  //    truncated line from an interrupted run heals instead of lingering.
  const existing = [];
  const seen = new Set();
  const seenUrls = new Set();
  if (fs.existsSync(datasetOut)) {
    for (const line of fs.readFileSync(datasetOut, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row && typeof row.text === "string" && row.label === LABEL) {
          existing.push(row);
          seen.add(hash(row.text));
          if (typeof row.source === "string") seenUrls.add(row.source);
        }
      } catch {
        console.warn("dataset: dropping malformed existing line");
      }
    }
    fs.writeFileSync(datasetOut, existing.map((row) => JSON.stringify(row)).join("\n") + (existing.length ? "\n" : ""));
  }
  let kept = existing.length;
  console.log(`dataset: keeping ${existing.length} valid existing row(s)`);

  // 3. Candidate queue: phase 0 takes each subject's first paper, phase 1 its
  //    second, … so diversity across subjects comes before depth within one.
  const queue = [];
  const perSubject = Array.from({ length: PER_SUBJECT }, () => []);
  const meta = new Map();
  for (const code of orderedCodes) {
    try {
      const json = await getJson(papersApi(code));
      const papers = shuffle(json?.data?.papers ?? []);
      if (!papers.length) continue;
      meta.set(code, papers);
      papers.slice(0, PER_SUBJECT).forEach((_, i) => perSubject[i].push(code));
    } catch (err) {
      console.warn(`dataset: list failed for ${code}: ${err.message}`);
    }
  }
  const queued = new Map(); // code -> how many of its papers are already queued
  for (const codesAtPhase of perSubject) {
    for (const code of codesAtPhase) {
      const papers = meta.get(code);
      const idx = queued.get(code) ?? 0;
      if (papers[idx]) {
        queue.push({ code, paper: papers[idx] });
        queued.set(code, idx + 1);
      }
    }
  }
  console.log(`dataset: ${queue.length} candidate paper(s) queued`);

  // 4. Walk the queue until the target is hit.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scanpdf-"));
  let digital = 0;
  let ocrd = 0;
  let skipped = 0;
  let index = existing.length;

  try {
    for (const { code, paper } of queue) {
      if (index >= TARGET) break;
      const url = paper.file_url;
      if (!url || seenUrls.has(url)) continue;
      const file = path.join(tmpDir, "paper.pdf");
      try {
        await download(url, file);
      } catch (err) {
        skipped++;
        console.warn(`dataset: download failed ${code}: ${err.message}`);
        continue;
      }

      let method = "pdftotext";
      let text = normalize(pdfToText(file));
      if (text.length < MIN_CHARS) {
        const normalised = normalize(await ocrPages(file, OCR_PAGES));
        if (normalised.length >= text.length) {
          method = "tesseract";
          text = normalised;
        }
      }
      seenUrls.add(url);

      if (text.length < MIN_CHARS) {
        skipped++;
        console.warn(`dataset: too little text (${text.length}) ${code} ${url}`);
        continue;
      }
      const h = hash(text);
      if (seen.has(h)) {
        skipped++;
        continue;
      }
      seen.add(h);

      index++;
      kept++;
      if (method === "tesseract") ocrd++;
      else digital++;
      console.log(
        `[${index}/${TARGET}] ${method} ${code} ${text.length} chars ${paper.exam ?? "?"} ${url.split("/").pop()}`,
      );
      fs.appendFileSync(
        datasetOut,
        `${JSON.stringify({ text: text.slice(0, MAX_CHARS), label: LABEL, source: url, method })}\n`,
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (ocrWorker) await ocrWorker.terminate().catch(() => {});
  }

  console.log(
    `dataset: done — ${kept} row(s) total (${digital} pdftotext, ${ocrd} OCR'd this run, ${skipped} skipped)`,
  );
  if (kept === 0) {
    console.error("dataset: refusing to leave an empty corpus behind");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
