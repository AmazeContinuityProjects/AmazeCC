import fs from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractScanFeatures, FEATURE_COUNT, FEATURE_NAMES, KIND_KEYWORDS } from "../lib/scanner/nn/features";
import { argmax, forward, softmax, type MlpModel } from "../lib/scanner/nn/mlp";
import { classifyScan, MODEL_INFO, predictKind } from "../lib/scanner/nn/model";
import { PAPER_KINDS } from "../lib/scanner/types";
import weights from "../lib/scanner/nn/weights.json";

/** Neutral value the extractor uses for "genuinely unknown" measurements. */
const NEUTRAL = 0.5;

/* ------------------------------------------------------------- fixtures */

const EXAM_TEXT = [
  "B.TECH. DEGREE EXAMINATION",
  "(CAT - II)",
  "COURSE CODE: BCSE204L",
  "TIME: 3 HOURS",
  "MAXIMUM MARKS: 50",
  "Register Number: 21BCE10234",
  "Name of the Student: Aarav Kumar",
  "SECTION A — Answer ALL questions",
  "1. Define normalisation and list its types with examples.",
  "2. Explain the working of the system with a neat diagram.",
  "SECTION B (5 x 8 = 40 Marks)",
  "3. Derive the expression for the output voltage of the circuit.",
  "Signature of the Invigilator",
  "Page 1 of 3",
].join("\n");

/**
 * The same paper as the OCR engine actually returns it: stray header glyphs,
 * a garbled name line, letter/number substitutions in the body. The large
 * header text ("MAXIMUM MARKS", "SECTION A") survives OCR in practice, so
 * those stay intact — what breaks is everything smaller.
 */
const NOISY_EXAM_TEXT = [
  "SX \\ 7 T SLOT: C2+TC- | =r Vellore Institute of Technology",
  "REG. NO.: Jum Ges NS (Deemed to be aL BE green ploy",
  "B.TECH. DEGREE EXAMINATION",
  "(CAT - II)",
  "COURSE CODE: BCSE204L",
  "TIME: 3 HOURS",
  "MAXIMUM MARKS: 50",
  "Register Number: 21BCE10234",
  "Narne of the Student: Aarav Kumar",
  "SECTION A — Answer ALL questions",
  "I. Def1ne normalisation and 1ist its types with exaroples.",
  "2. Exp1ain the working of the system with a neat dlagram.",
  "SECTION B (5 x 8 = 40 Marks)",
  "3. Der1ve the expresslon for the output vo1tage of the clrcult.",
  "Signature of the Invigilator",
  "Page 1 of 3",
].join("\n");

const ASSIGNMENT_TEXT = [
  "ASSIGNMENT 2",
  "Course: CSE2001 — Assignment Work",
  "Submitted by: Diya Sharma (Reg No: 22BCE10456)",
  "Team: Null Pointers",
  "Submission deadline: 15-Mar-2026",
  "Q1. Explain the working of the system with a neat diagram.",
  "Q2. Define normalisation and list its types with examples.",
  "Submit on or before 18-Mar-2026 through the learning portal.",
  "Guidelines: plagiarism above 10% is rejected",
  "Handover to: the course instructor",
].join("\n");

const NOTES_TEXT = [
  "Lecture Notes — Unit II",
  "CSE2001 Notes",
  "Chapter 4: Data Structures",
  "Date: 12-Feb-2026",
  "Topics covered: Data Structures, Control Systems",
  "Definition: Data Structures and its properties.",
  "Example: consider the case where the input is already sorted.",
  "Theorem: the result holds for all admissible values.",
  "Note: this was announced in class last week.",
  "Key idea: Explain the working of the system with a neat diagram",
].join("\n");

/** Index of a feature in the vector — by name, never by magic position. */
const at = (name: string): number => {
  const i = FEATURE_NAMES.indexOf(name);
  if (i < 0) throw new Error(`unknown feature ${name}`);
  return i;
};

const score = (name: string, text: string): number =>
  extractScanFeatures({ text, ocrConfidence: null, image: null })[at(name)];

/* ------------------------------------------------------------- features */

describe("scanner nn: feature extraction", () => {
  it("keeps the feature contract: unique names, matching count", () => {
    expect(FEATURE_COUNT).toBe(FEATURE_NAMES.length);
    expect(FEATURE_COUNT).toBeGreaterThan(0);
    expect(new Set(FEATURE_NAMES).size).toBe(FEATURE_NAMES.length);
    for (const name of FEATURE_NAMES) expect(name).toMatch(/^[a-zA-Z]+$/);
  });

  it("produces a bounded, finite, deterministic vector", () => {
    for (const text of [EXAM_TEXT, ASSIGNMENT_TEXT, "", " \u0001 binary \u2603 junk "]) {
      const a = extractScanFeatures({ text });
      const b = extractScanFeatures({ text });
      expect(a).toHaveLength(FEATURE_COUNT);
      expect(a).toEqual(b);
      for (const v of a) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("reads unknown engine/image measurements as neutral, provided ones as data", () => {
    const unknown = extractScanFeatures({ text: EXAM_TEXT, ocrConfidence: null, image: null });
    expect(unknown[at("ocrConf")]).toBe(NEUTRAL);
    expect(unknown[at("inkRatio")]).toBe(NEUTRAL);

    const measured = extractScanFeatures({
      text: EXAM_TEXT,
      ocrConfidence: 80,
      image: { inkRatio: 0.2, contrast: 0.9, edgeDensity: 0.4, quadFill: 1 },
    });
    expect(measured[at("ocrConf")]).toBeCloseTo(0.8, 10);
    expect(measured[at("inkRatio")]).toBeCloseTo(0.2, 10);
    expect(measured[at("quadFill")]).toBe(1);
    expect(measured[at("pageCount")]).toBeCloseTo(1 / 6, 10);
    expect(extractScanFeatures({ text: EXAM_TEXT, pageCount: 6 })[at("pageCount")]).toBe(1);
  });

  it("scores each keyword family against the text that belongs to it", () => {
    expect(KIND_KEYWORDS.exam.length).toBeGreaterThan(0);
    expect(score("examSignal", EXAM_TEXT)).toBeGreaterThan(score("examSignal", ASSIGNMENT_TEXT));
    expect(score("assignmentSignal", ASSIGNMENT_TEXT)).toBeGreaterThan(score("assignmentSignal", EXAM_TEXT));
    expect(score("notesSignal", NOTES_TEXT)).toBeGreaterThan(score("notesSignal", EXAM_TEXT));
  });

  it("keeps exam signals when OCR garbles the body", () => {
    // The header keywords are what the model leans on; body noise must not
    // erase them, or every real camera scan would score as "other".
    expect(score("examSignal", NOISY_EXAM_TEXT)).toBeGreaterThanOrEqual(score("examSignal", EXAM_TEXT) - 0.05);
    expect(score("examSignal", NOISY_EXAM_TEXT)).toBeGreaterThan(0.4);
  });
});

/* ----------------------------------------------------------------- mlp */

describe("scanner nn: mlp", () => {
  it("softmaxes to a distribution and survives extreme logits", () => {
    const uniform = softmax([4, 4, 4]);
    expect(uniform).toHaveLength(3);
    for (const v of uniform) expect(v).toBeCloseTo(1 / 3, 10);

    const skewed = softmax([1000, 999, -1000]);
    expect(skewed.every(Number.isFinite)).toBe(true);
    expect(skewed.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(skewed[0]).toBeGreaterThan(skewed[1]);

    const tiny = softmax([-1000, -1001]);
    expect(tiny.every(Number.isFinite)).toBe(true);
    expect(tiny[0]).toBeGreaterThan(tiny[1]);
  });

  it("runs a tiny model end to end", () => {
    const model: MlpModel = {
      sizes: [2, 2, 1],
      layers: [
        {
          W: [
            [1, 1],
            [-1, -1],
          ],
          b: [0, 0],
        },
        { W: [[1, -1]], b: [0] },
      ],
    };
    const out = forward(model, [1, 0]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBeCloseTo(1, 10); // softmax of a single logit
  });

  it("throws loudly on shape mismatches instead of computing nonsense", () => {
    expect(() => forward({ sizes: [2], layers: [] }, [1, 2])).toThrow(/no layers/);
    expect(() => forward({ sizes: [2, 1], layers: [{ W: [[1, 1]], b: [0] }] }, [1])).toThrow(/expects 2 inputs, got 1/);
    // Corrupt weights: a row longer than the incoming vector.
    expect(() => forward({ sizes: [2, 1], layers: [{ W: [[1, 2, 3]], b: [0] }] }, [1, 1])).toThrow(
      /row 0: expects 3 inputs, got 2/,
    );
    // Corrupt weights: weight rows and biases disagree.
    expect(() => forward({ sizes: [2, 2], layers: [{ W: [[1, 1]], b: [0, 0] }] }, [1, 1])).toThrow(
      /1 weight rows vs 2 biases/,
    );
  });

  it("argmax picks the first maximum", () => {
    expect(argmax([0.1, 0.7, 0.2])).toBe(1);
    expect(argmax([0.5, 0.5, 0.2])).toBe(0);
    expect(argmax([])).toBe(0);
  });
});

/* --------------------------------------------------------------- model */

describe("scanner nn: shipped weights", () => {
  it("matches the code that feeds it", () => {
    expect(weights.version).toBe(1);
    expect(weights.featureNames).toEqual([...FEATURE_NAMES]);
    expect(weights.sizes[0]).toBe(FEATURE_COUNT);
    expect(weights.sizes[weights.sizes.length - 1]).toBe(weights.classes.length);
    for (const cls of weights.classes) expect(PAPER_KINDS).toContain(cls);
    expect(weights.metrics.samples).toBeGreaterThanOrEqual(360); // synthetic floor
    expect(weights.metrics.valAccuracy).toBeGreaterThanOrEqual(0.85); // trainer's gate
  });

  it("stays tiny — a few hundred parameters, no runtime in the bundle", () => {
    expect(MODEL_INFO.params).toBeGreaterThan(100);
    expect(MODEL_INFO.params).toBeLessThan(2000);
  });

  it("refuses vectors of the wrong length", () => {
    expect(() => predictKind([1, 2, 3])).toThrow(/Expected \d+ scanner features, got 3/);
  });

  it("classifies a clean exam paper as an exam", () => {
    const pred = classifyScan({ text: EXAM_TEXT, ocrConfidence: null, image: null });
    expect(pred.kind).toBe("exam");
    expect(pred.confidence).toBeGreaterThan(0);
    expect(pred.confidence).toBeLessThanOrEqual(1);

    const sum = PAPER_KINDS.reduce((total, kind) => total + (pred.probabilities[kind] ?? 0), 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("classifies a noisy OCR scan of the same paper as an exam", () => {
    // The whole point of OCR'ing real scanned papers into the corpus: a
    // camera scan never comes out clean.
    const pred = classifyScan({ text: NOISY_EXAM_TEXT, ocrConfidence: 62, image: null });
    expect(pred.kind).toBe("exam");
  });

  it("separates assignments and lecture notes from exams", () => {
    expect(classifyScan({ text: ASSIGNMENT_TEXT }).kind).toBe("assignment");
    expect(classifyScan({ text: NOTES_TEXT }).kind).toBe("notes");
  });

  it("is deterministic — same scan in, same prediction out", () => {
    const a = classifyScan({ text: EXAM_TEXT, ocrConfidence: 77, image: null });
    const b = classifyScan({ text: EXAM_TEXT, ocrConfidence: 77, image: null });
    expect(a).toEqual(b);
  });
});

/* -------------------------------------------------------------- corpus */

describe("scanner nn: real corpus from papers.codechefvit.com", () => {
  const file = resolve(process.cwd(), "scripts/scanner-nn-dataset.jsonl");

  it("exists and holds well-formed real samples, scanned ones included", () => {
    expect(fs.existsSync(file)).toBe(true);
    const rows = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { text: string; label: string; method: string });

    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      expect(typeof row.text).toBe("string");
      expect(row.text.length).toBeGreaterThanOrEqual(100);
      expect(PAPER_KINDS).toContain(row.label);
      expect(["pdftotext", "tesseract"]).toContain(row.method);
    }
    // Scanned papers must be represented: OCR'd text is what a camera scan
    // actually produces at inference time, so the model has to have seen it.
    expect(rows.some((row) => row.method === "tesseract")).toBe(true);
  });
});
