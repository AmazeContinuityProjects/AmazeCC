#!/usr/bin/env node
/**
 * Train the Paper Scanner's neural net and write `src/lib/scanner/nn/weights.json`.
 *
 *   node scripts/train-scanner-nn.mjs
 *
 * The model is a ~500-parameter MLP over the 28 features in
 * `src/lib/scanner/nn/features.ts`. Training happens here, outside the app,
 * because a static-export site ships inference, not a training loop.
 *
 * ## Why the corpus is synthetic (and how to feed it real data)
 *
 * There is no labelled pile of scanned papers in this repo. So the script
 * composes one from per-kind templates — exam headers, assignment deadlines,
 * lecture-note units, form fields — with randomized phrasing, lengths, noise
 * lines and course codes, so the net learns the *signals* (a "Maximum Marks"
 * header, a "Submission deadline" line) rather than memorising sentences.
 * Image/OCR-quality features are drawn independently of the label on purpose:
 * the net learns to weight them near zero instead of inventing a correlation
 * that does not exist.
 *
 * If you collect real samples, drop them in
 * `scripts/scanner-nn-dataset.jsonl` — one `{"text": "...", "label": "..."}`
 * per line — and they are merged into the training set. Real data always wins.
 *
 * Deterministic end to end (seeded RNG): re-running produces byte-identical
 * weights. Fails loudly (exit 1) if held-out accuracy drops below
 * MIN_VAL_ACCURACY, so a bad edit cannot quietly ship a degraded model.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const featuresSrc = path.join(root, "src/lib/scanner/nn/features.ts");
const weightsOut = path.join(root, "src/lib/scanner/nn/weights.json");
const realDataset = path.join(root, "scripts/scanner-nn-dataset.jsonl");

const MIN_VAL_ACCURACY = 0.85;
const CLASSES = ["exam", "assignment", "notes", "worksheet", "form", "other"];
const SAMPLES_PER_CLASS = 60;
const HIDDEN = 16;
const SEED = 20261104;

/* ------------------------------------------------------------------ rng */

/** mulberry32 — small, fast, and identical across runs for a fixed seed. */
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

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const chance = (rng, p) => rng() < p;
/** Pick `k` distinct-ish entries (with replacement, order shuffled). */
const sample = (rng, arr, k) => {
  const out = [];
  for (let i = 0; i < k; i++) out.push(pick(rng, arr));
  return out;
};

/* --------------------------------------------------------------- corpus */

const DEPTS = ["CSE", "ECE", "MECH", "CIVIL", "EEE", "BTCH", "CHEM", "MATH", "PHY"];
const TOPICS = [
  "Normal Forms and Relations",
  "Thermodynamic Cycles",
  "Data Structures",
  "Control Systems",
  "Engineering Mathematics",
  "Signals and Systems",
  "Structural Analysis",
  "Molecular Biology",
];
const PROSE = [
  "The department wishes to remind all students that the library will close early on Friday.",
  "Please refer to the attached appendix for the complete list of references.",
  "Kindly verify your details before the deadline and report discrepancies to the office.",
  "This document is issued for academic purposes and is not transferable.",
  "Students are advised to carry a valid identity card at all times.",
];
const QUESTIONS = [
  "Explain the working of the system with a neat diagram.",
  "Define normalisation and list its types with examples.",
  "Derive the expression for the output voltage of the circuit.",
  "Compare stack and queue with suitable examples.",
  "Write short notes on any two of the following.",
  "Solve the differential equation subject to the given conditions.",
  "Discuss the phases of the software development life cycle.",
  "Calculate the efficiency of the algorithm for the given input.",
];
const WORKSHEET_TASKS = [
  "Choose the correct answer",
  "Fill in the blanks",
  "Match the following",
  "Solve the following problems",
  "True or False",
  "Answer in one word",
];
const NOISE = [
  "Printed on recycled paper.",
  "Batch: A",
  "Roll list enclosed.",
  "Copy to: Class teacher.",
  "Ref: VS/2026/117",
  "Keep this copy for your records.",
];

function courseCode(rng) {
  return `${pick(rng, DEPTS)}${int(rng, 1001, 4999)}`;
}
function regNo(rng) {
  return `${int(rng, 21, 25)}${int(rng, 100000, 999999)}`;
}
function dateLine(rng) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${int(rng, 1, 28)}-${pick(rng, months)}-${int(rng, 2024, 2027)}`;
}
function maybeNoise(rng, lines, p = 0.3) {
  if (chance(rng, p)) lines.push(pick(rng, NOISE));
}

function examText(rng) {
  const lines = [
    `${pick(rng, ["B.E.", "B.TECH.", "M.SC."])} DEGREE EXAMINATION`,
    `(${pick(rng, ["CAT - I", "CAT - II", "FAT", "MID SEMESTER EXAMINATION", "END SEMESTER EXAMINATION"])})`,
    `COURSE CODE: ${courseCode(rng)}`,
    `TIME: ${pick(rng, [3, 4])} HOURS`,
    `MAXIMUM MARKS: ${pick(rng, [50, 60, 100])}`,
    `Register Number: ${regNo(rng)}`,
    `Name of the Student: ${pick(rng, ["Aarav", "Diya", "Kiran", "Meera", "Rohan", "Sara"])} ${pick(rng, ["Kumar", "Sharma", "Iyer", "Patel", "Nair"])}`,
    `SECTION A ${pick(rng, ["(10 x 2 = 20 Marks)", "(5 x 2 = 10 Marks)", "— Answer ALL questions"])}`,
  ];
  const qCount = int(rng, 2, 5);
  for (let i = 1; i <= qCount; i++) {
    lines.push(
      chance(rng, 0.5)
        ? `${i}. ${pick(rng, QUESTIONS)}`
        : `${i}. (a) ${pick(rng, QUESTIONS)} (b) ${pick(rng, QUESTIONS)}`,
    );
  }
  if (chance(rng, 0.6)) lines.push(`SECTION B ${pick(rng, ["(5 x 8 = 40 Marks)", "(OR)", "Answer any FOUR"])}`);
  lines.push(pick(rng, ["Signature of the Invigilator", "Invigilator Signature", "Signature of the Candidate"]));
  lines.push(`Page ${int(rng, 1, 3)} of ${int(rng, 3, 6)}`);
  maybeNoise(rng, lines, 0.35);
  return lines.join("\n");
}

function assignmentText(rng) {
  const lines = [
    `ASSIGNMENT ${int(rng, 1, 4)}`,
    `Course: ${courseCode(rng)} ${pick(rng, ["— Assignment", "Assignment Work", "Mini Project"])}`,
    `Submitted by: ${pick(rng, ["Aarav", "Diya", "Kiran", "Meera"])} ${pick(rng, ["Kumar", "Sharma", "Iyer"])} (Reg No: ${regNo(rng)})`,
    `Team: ${pick(rng, ["Alpha", "Beta", "Byteforce", "Null Pointers", "Team 7"])}`,
    `Submission deadline: ${dateLine(rng)}`,
  ];
  const qCount = int(rng, 2, 4);
  for (let i = 1; i <= qCount; i++) lines.push(`Q${i}. ${pick(rng, QUESTIONS)}`);
  lines.push(`Submit on or before ${dateLine(rng)} through the learning portal.`);
  if (chance(rng, 0.5))
    lines.push(
      `Guidelines: ${pick(rng, ["plagiarism above 10% is rejected", "attach a screenshot of the output", "late submission attracts a penalty"])}`,
    );
  lines.push(`Handover to: ${pick(rng, ["the course instructor", "the lab assistant", "class teacher"])}`);
  maybeNoise(rng, lines, 0.3);
  return lines.join("\n");
}

function notesText(rng) {
  const roman = pick(rng, ["I", "II", "III", "IV", "V"]);
  const lines = [
    `${pick(rng, ["Lecture Notes", "Class Notes", "Notes"])} — Unit ${roman}`,
    `${courseCode(rng)} ${pick(rng, ["Notes", "Handout"])}`,
    `Chapter ${int(rng, 1, 12)}: ${pick(rng, TOPICS)}`,
    `Date: ${dateLine(rng)}`,
    `Topics covered: ${sample(rng, TOPICS, 2).join(", ")}`,
  ];
  const count = int(rng, 3, 6);
  for (let i = 0; i < count; i++) {
    lines.push(
      pick(rng, [
        `Definition: ${pick(rng, TOPICS)} and its properties.`,
        `Example: consider the case where the input is already sorted.`,
        `Theorem: the result holds for all admissible values.`,
        `Note: this was announced in class last week.`,
        `Key idea: ${pick(rng, QUESTIONS).replace(/\?$/, "")}`,
      ]),
    );
  }
  maybeNoise(rng, lines, 0.25);
  return lines.join("\n");
}

function worksheetText(rng) {
  const lines = [
    `Worksheet ${int(rng, 1, 9)}`,
    `${pick(rng, ["Practice Worksheet", "Practice Exercises", "Worksheet"])} — ${pick(rng, TOPICS)}`,
    `Course: ${courseCode(rng)}`,
    `Name: ${pick(rng, ["Aarav", "Diya", "Kiran", "Meera"])}   Reg No: ${regNo(rng)}`,
  ];
  const count = int(rng, 3, 6);
  for (let i = 1; i <= count; i++) {
    lines.push(`${i}. ${pick(rng, WORKSHEET_TASKS)} — ${pick(rng, QUESTIONS).replace(/\?$/, ".")}`);
  }
  if (chance(rng, 0.5)) lines.push(`Answer Key: ${sample(rng, ["a", "b", "c", "d"], 4).join(", ")}`);
  maybeNoise(rng, lines, 0.25);
  return lines.join("\n");
}

function formText(rng) {
  const lines = [
    pick(rng, [
      "Declaration Form",
      "Application for Identity Card",
      "Bonafide Certificate Application",
      "Student Record Form",
    ]),
    `Date: ${dateLine(rng)}`,
    `Name: ${pick(rng, ["Aarav", "Diya", "Kiran", "Meera", "Rohan"])} ${pick(rng, ["Kumar", "Sharma", "Iyer", "Patel"])}`,
    `Reg No: ${regNo(rng)}`,
    `Gender: ${pick(rng, ["M", "F", "Other"])}`,
    `Department: ${pick(rng, DEPTS)}   Semester: ${int(rng, 1, 8)}`,
    `Purpose of issue: ${pick(rng, ["passport verification", "bank account", "scholarship", "library clearance"])}`,
  ];
  if (chance(rng, 0.7))
    lines.push(
      `Guardian Name: ${pick(rng, ["Ramesh", "Sunita", "Anil", "Lakshmi"])} ${pick(rng, ["Kumar", "Devi", "Sharma"])}`,
    );
  if (chance(rng, 0.8)) {
    lines.push(`I hereby declare that the information furnished above is true to the best of my knowledge.`);
  }
  lines.push(`Place: ${pick(rng, ["Vellore", "Chennai", "Bengaluru", "Coimbatore"])}`);
  lines.push(`Signature: ____________________`);
  maybeNoise(rng, lines, 0.3);
  return lines.join("\n");
}

function otherText(rng) {
  const lines = [pick(rng, ["Notice", "Circular", "Memo", "Handout"])];
  lines.push(...sample(rng, PROSE, int(rng, 2, 5)));
  if (chance(rng, 0.4)) lines.push(`Course: ${courseCode(rng)}`);
  if (chance(rng, 0.3)) lines.push(`Date: ${dateLine(rng)}`);
  maybeNoise(rng, lines, 0.4);
  return lines.join("\n");
}

const GENERATORS = {
  exam: examText,
  assignment: assignmentText,
  notes: notesText,
  worksheet: worksheetText,
  form: formText,
  other: otherText,
};

/* --------------------------------------------------------------- model */

function initModel(rng) {
  const sizes = [28, HIDDEN, CLASSES.length];
  const layers = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const fanIn = sizes[l];
    // He init for ReLU layers keeps early activations in range; the readout
    // gets a smaller scale so softmax starts near-uniform.
    const scale = l === sizes.length - 2 ? 0.1 : Math.sqrt(2 / fanIn) * 0.5;
    const W = [];
    for (let j = 0; j < sizes[l + 1]; j++) {
      const row = [];
      for (let i = 0; i < fanIn; i++) row.push((rng() * 2 - 1) * scale);
      W.push(row);
    }
    layers.push({ W, b: new Array(sizes[l + 1]).fill(0) });
  }
  return { sizes, layers };
}

function forwardCached(model, x) {
  const acts = [x];
  let a = x;
  for (let l = 0; l < model.layers.length; l++) {
    const { W, b } = model.layers[l];
    const isLast = l === model.layers.length - 1;
    const out = new Array(b.length);
    for (let j = 0; j < b.length; j++) {
      const row = W[j];
      let sum = b[j];
      for (let i = 0; i < row.length; i++) sum += row[i] * a[i];
      out[j] = isLast ? sum : sum > 0 ? sum : 0;
    }
    acts.push(out);
    a = out;
  }
  const logits = acts[acts.length - 1];
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((p, c) => p + c, 0) || 1;
  const probs = exps.map((v) => v / sum);
  return { acts, probs };
}

function train(model, data, { epochs, lr, momentum, decay }) {
  const vel = model.layers.map(({ W }) => W.map((row) => row.map(() => 0)));
  const velB = model.layers.map(({ b }) => b.map(() => 0));

  for (let epoch = 0; epoch < epochs; epoch++) {
    // Full-batch gradients: the set is a few hundred rows, so batching only
    // adds nondeterminism to a script whose whole value is reproducibility.
    const gW = model.layers.map(({ W }) => W.map((row) => row.map(() => 0)));
    const gB = model.layers.map(({ b }) => b.map(() => 0));
    let loss = 0;

    for (const { x, y } of data) {
      const { acts, probs } = forwardCached(model, x);
      loss += -Math.log(Math.max(probs[y], 1e-12));

      // d(CE)/d(logits) = probs − onehot(y)
      let delta = probs.map((p, i) => p - (i === y ? 1 : 0));
      for (let l = model.layers.length - 1; l >= 0; l--) {
        const prev = acts[l];
        for (let j = 0; j < delta.length; j++) {
          gB[l][j] += delta[j];
          const gRow = gW[l][j];
          for (let i = 0; i < prev.length; i++) gRow[i] += delta[j] * prev[i];
        }
        if (l > 0) {
          const { W } = model.layers[l];
          const next = new Array(prev.length).fill(0);
          for (let j = 0; j < delta.length; j++) {
            const row = W[j];
            const d = delta[j];
            if (d === 0) continue;
            for (let i = 0; i < prev.length; i++) next[i] += d * row[i];
          }
          // ReLU derivative against the *pre-activation* we stored as this
          // layer's input (it is post-ReLU of l−1, so ≤0 means it was off).
          delta = next.map((v, i) => (prev[i] > 0 ? v : 0));
        }
      }
    }

    const n = data.length;
    for (let l = 0; l < model.layers.length; l++) {
      for (let j = 0; j < model.layers[l].W.length; j++) {
        for (let i = 0; i < model.layers[l].W[j].length; i++) {
          const g = gW[l][j][i] / n + decay * model.layers[l].W[j][i];
          vel[l][j][i] = momentum * vel[l][j][i] - lr * g;
          model.layers[l].W[j][i] += vel[l][j][i];
        }
        const gb = gB[l][j] / n;
        velB[l][j] = momentum * velB[l][j] - lr * gb;
        model.layers[l].b[j] += velB[l][j];
      }
    }

    if (epoch % 50 === 0) {
      const acc = accuracy(model, data);
      if (epoch === 0 || epoch % 200 === 0)
        process.stdout.write(`  epoch ${epoch}: loss ${(loss / n).toFixed(4)} acc ${acc.toFixed(3)}\n`);
    }
  }
}

function accuracy(model, data) {
  let ok = 0;
  for (const { x, y } of data) {
    const { probs } = forwardCached(model, x);
    let best = 0;
    for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
    if (best === y) ok++;
  }
  return ok / data.length;
}

/* ----------------------------------------------------------------- main */

async function loadFeaturesModule() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-nn-"));
  const tsc = path.join(root, "node_modules", ".bin", "tsc");
  execFileSync(
    tsc,
    [
      featuresSrc,
      "--outDir",
      tmp,
      "--module",
      "esnext",
      "--moduleResolution",
      "bundler",
      "--target",
      "es2022",
      "--skipLibCheck",
    ],
    { stdio: "pipe" },
  );
  // The package is CommonJS, so ESM output must carry an .mjs extension.
  const js = path.join(tmp, "features.js");
  const mjs = path.join(tmp, "features.mjs");
  fs.renameSync(js, mjs);
  try {
    return await import(pathToFileURL(mjs).href);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const { extractScanFeatures, FEATURE_NAMES } = await loadFeaturesModule();

  const rng = makeRng(SEED);
  const labelled = [];

  for (const label of CLASSES) {
    const gen = GENERATORS[label];
    for (let i = 0; i < SAMPLES_PER_CLASS; i++) {
      labelled.push({ text: gen(rng), label });
    }
  }

  // Merge real data when present — it is always the better half of the set.
  if (fs.existsSync(realDataset)) {
    let merged = 0;
    for (const line of fs.readFileSync(realDataset, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row && typeof row.text === "string" && CLASSES.includes(row.label)) {
          labelled.push({ text: row.text, label: row.label });
          merged++;
        }
      } catch {
        console.warn("scanner-nn: skipping malformed dataset line");
      }
    }
    if (merged) console.log(`merged ${merged} real sample(s) from scanner-nn-dataset.jsonl`);
  }

  // Stratified split: every 5th sample of each class goes to validation, so
  // neither half can drift to an easier class distribution than the other.
  const toVector = (text) => extractScanFeatures({ text, ocrConfidence: null, image: null, pageCount: 1 });
  const trainSet = [];
  const valSet = [];
  labelled.forEach((row, idx) => {
    const item = { x: toVector(row.text), y: CLASSES.indexOf(row.label) };
    (idx % 5 === 2 ? valSet : trainSet).push(item);
  });

  console.log(`training: ${trainSet.length} train / ${valSet.length} val samples, ${FEATURE_NAMES.length} features`);

  const model = initModel(makeRng(SEED ^ 0x5f5f));
  train(model, trainSet, { epochs: 1500, lr: 0.08, momentum: 0.9, decay: 1e-4 });

  const trainAcc = accuracy(model, trainSet);
  const valAcc = accuracy(model, valSet);
  console.log(`train accuracy: ${(trainAcc * 100).toFixed(1)}%   val accuracy: ${(valAcc * 100).toFixed(1)}%`);

  if (valAcc < MIN_VAL_ACCURACY) {
    console.error(`refusing to write weights: val accuracy ${(valAcc * 100).toFixed(1)}% < ${MIN_VAL_ACCURACY * 100}%`);
    process.exit(1);
  }

  const round = (v) => Math.round(v * 1e5) / 1e5;
  const weights = {
    version: 1,
    trainedAt: new Date().toISOString(),
    classes: CLASSES,
    featureNames: [...FEATURE_NAMES],
    sizes: model.sizes,
    layers: model.layers.map(({ W, b }) => ({ W: W.map((row) => row.map(round)), b: b.map(round) })),
    metrics: {
      samples: labelled.length,
      trainAccuracy: round(trainAcc),
      valAccuracy: round(valAcc),
      seed: SEED,
    },
  };

  fs.writeFileSync(weightsOut, `${JSON.stringify(weights, null, 2)}\n`);
  const kb = (fs.statSync(weightsOut).size / 1024).toFixed(1);
  console.log(`wrote ${path.relative(root, weightsOut)} (${kb} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
