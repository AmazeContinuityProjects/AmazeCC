/**
 * Feature extraction for the scanner's neural net.
 *
 * Turns one scan (OCR text + a few image statistics) into a fixed-length
 * vector the tiny MLP in `mlp.ts` can consume. Two rules shape this file:
 *
 * 1. **Standalone by design** — no imports, not even type-only ones. The
 *    training script (`scripts/train-scanner-nn.mjs`) transpiles this exact
 *    file with `tsc` and runs it in Node, so the model is always trained on
 *    the same features the app scores with. A duplicated copy would drift.
 * 2. **Every feature is bounded and cheap** — ratios, flags and log-scaled
 *    counts in [0,1]. The vector is computed once per page on a phone.
 *
 * The keyword groups are the model's actual vocabulary: what separates an
 * exam paper from an assignment in practice ("Maximum Marks", "Submission
 * deadline", "Lecture notes"). They live here so training and inference can
 * never disagree about what a "form" looks like.
 */

/** What the extractor is given for one scan. */
export interface ScanFeatureInput {
  /** OCR text of the (concatenated) pages. May be empty when OCR was unavailable. */
  text: string;
  /** 0–100 from the OCR engine, or null when it reported none. */
  ocrConfidence?: number | null;
  /** Image statistics of the first page, or null when unknown. */
  image?: {
    inkRatio: number;
    contrast: number;
    edgeDensity: number;
    quadFill: number;
  } | null;
  /** Pages in the document. */
  pageCount?: number;
}

/** Keyword families — one per paper kind, presence-scored as a fraction found. */
export const KIND_KEYWORDS: Record<string, readonly string[]> = {
  exam: [
    "examination",
    "degree examination",
    "cat - i",
    "cat - ii",
    "fat",
    "mid semester",
    "end semester",
    "answer all",
    "answer the following",
    "section a",
    "section b",
    "maximum marks",
    "max. marks",
    "time:",
    "hours",
    "register number",
    "invigilator",
    "question paper",
    "omr",
  ],
  assignment: [
    "assignment",
    "submission",
    "submitted",
    "deadline",
    "due date",
    "submit",
    "project work",
    "team name",
    "guidelines",
    "rubric",
    "turnitin",
    "handover",
  ],
  notes: [
    "lecture notes",
    "lecture",
    "chapter",
    "unit i",
    "unit ii",
    "topic",
    "definition",
    "theorem",
    "example",
    "announced in class",
    "board work",
    "cs notes",
  ],
  worksheet: [
    "worksheet",
    "practice",
    "exercise",
    "solve the following",
    "problems",
    "answer key",
    "fill in the blanks",
    "choose the correct",
    "match the following",
    "multiple choice",
    "objective type",
  ],
  form: [
    "name:",
    "date:",
    "signature",
    "i hereby declare",
    "declaration",
    "place:",
    "gender",
    "department",
    "admission",
    "id number",
    "relationship",
    "guardian",
    "purpose of issue",
  ],
};

/**
 * Ordered feature names — the vector's contract. `weights.json` records the
 * names it was trained with and `model.ts` refuses a mismatch, so reordering
 * here without retraining fails loudly instead of silently misclassifying.
 */
export const FEATURE_NAMES: readonly string[] = [
  // --- text structure -----------------------------------------------------
  "digitRatio",
  "upperWordRatio",
  "lineCount",
  "textLen",
  "alphaRatio",
  "spaceRatio",
  "avgWordLen",
  "numberedItemRatio",
  "questionDensity",
  // --- kind signals -------------------------------------------------------
  "examSignal",
  "assignmentSignal",
  "notesSignal",
  "worksheetSignal",
  "formSignal",
  // --- field flags --------------------------------------------------------
  "rollNoFlag",
  "marksFlag",
  "durationFlag",
  "signatureFlag",
  "submissionFlag",
  "dateFlag",
  "pageNumberFlag",
  "mathRatio",
  // --- engine & image -----------------------------------------------------
  "ocrConf",
  "inkRatio",
  "contrast",
  "edgeDensity",
  "quadFill",
  "pageCount",
];

/** Length of every vector this extractor produces. */
export const FEATURE_COUNT = FEATURE_NAMES.length;

/** Neutral stand-in when a signal is genuinely unknown (never 0 — 0 is data). */
const NEUTRAL = 0.5;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function matches(text: string, pattern: RegExp): number {
  const m = text.match(pattern);
  return m ? m.length : 0;
}

/** Fraction of a keyword family that appears at least once. */
function signal(textLower: string, keywords: readonly string[]): number {
  let found = 0;
  for (const kw of keywords) {
    if (textLower.includes(kw)) found++;
  }
  return keywords.length === 0 ? 0 : found / keywords.length;
}

function flag(text: string, pattern: RegExp): number {
  return pattern.test(text) ? 1 : 0;
}

/**
 * Extract the fixed-length feature vector.
 *
 * Pure, deterministic, and total: empty text or a missing image still yields a
 * full-length vector (zeros for absent evidence, {@link NEUTRAL} for genuinely
 * unknown measurements) so the model never sees `NaN` — a scanned page with no
 * OCR must still get a kind, just a less confident one.
 */
export function extractScanFeatures(input: ScanFeatureInput): number[] {
  const text = input.text ?? "";
  const lower = text.toLowerCase();
  const nonSpace = text.replace(/\s/g, "");
  const chars = Math.max(text.length, 1);
  const nonSpaceCount = Math.max(nonSpace.length, 1);

  // Explicit `string[]` annotations: a bare `[]` fallback would make the union
  // `RegExpMatchArray | never[]` and degrade every later array op to `never`.
  const words: string[] = lower.match(/[a-z0-9']+/g) ?? [];
  const rawWords: string[] = text.match(/[A-Za-z0-9']+/g) ?? [];
  const wordCount = Math.max(words.length, 1);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const lineCount = Math.max(lines.length, 1);

  const letters = matches(nonSpace, /[a-zA-Z]/g);
  const digits = matches(nonSpace, /[0-9]/g);
  const spaces = matches(text, / /g);
  // Deliberately not `-`, `*` or `/`: those appear inside ordinary words,
  // dates and page numbers, and would fire the "math" signal on any paper.
  const mathChars = matches(nonSpace, /[=+×÷%^<>∑∫√≤≥±]/g);

  // Upper-case only counts for letter-only words — "CSE2001" is a course code,
  // not shouting, and would otherwise mark every paper as an exam header.
  const upperWords = rawWords.filter((w) => /^[A-Za-z]+$/.test(w) && w === w.toUpperCase()).length;
  const avgWordLen = words.reduce((sum, w) => sum + w.length, 0) / wordCount;

  const numberedLines = lines.filter((l) =>
    /^\s*(?:[#•▪]|\d+[.)]|[(]?\d+[)]|[a-z][.)]|[(][a-z][)]|[ivxIVX]+[.)])\s/i.test(l),
  ).length;

  const image = input.image;
  const ocrConf = input.ocrConfidence;

  return [
    // Structure. Log-scale the counts — a 40-line paper and a 400-line booklet
    // differ by an order of magnitude, but only the first few doublings say
    // anything about what kind of paper this is.
    clamp01(digits / nonSpaceCount),
    clamp01(upperWords / wordCount),
    clamp01(lines.length / 40),
    clamp01(Math.log1p(text.length) / Math.log1p(20000)),
    clamp01(letters / nonSpaceCount),
    clamp01(spaces / chars),
    clamp01(avgWordLen / 8),
    clamp01(numberedLines / lineCount),
    clamp01((matches(lower, /\b\d+[.)]\s/g) + matches(lower, /\([a-z]\)\s/g) + matches(lower, /\?/g)) / 12),

    // Kind signals.
    signal(lower, KIND_KEYWORDS.exam),
    signal(lower, KIND_KEYWORDS.assignment),
    signal(lower, KIND_KEYWORDS.notes),
    signal(lower, KIND_KEYWORDS.worksheet),
    signal(lower, KIND_KEYWORDS.form),

    // Field flags — the strongest individual discriminators, because real
    // papers carry them in fixed phrasing.
    flag(lower, /\b(roll\s*no|register\s*number|reg[.\s]*no|enrol(ment)?\s*(no|number))\b/),
    flag(lower, /\b(max(imum)?\s*marks?|marks?\s*:|grade|weightage|scored)\b/),
    flag(lower, /(\b\d+\s*(hours?|hrs?)\b)|(\btime\s*:)/),
    flag(lower, /\b(signature|signed|thumb\s*impression)\b/),
    flag(lower, /\b(submi(ttal|t)|deadline|due\s*date|turn[-\s]?in|on or before)\b/),
    flag(lower, /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/),
    flag(lower, /\bpage\s*\d+\s*(of|\/)\s*\d+\b|\b\d+\s*\/\s*\d+\b/),
    clamp01(mathChars / nonSpaceCount),

    // Engine & image. Absent measurements read as NEUTRAL, not zero — the
    // model was trained to weight them weakly, and 0 would claim "no contrast".
    ocrConf == null ? NEUTRAL : clamp01(ocrConf / 100),
    image ? clamp01(image.inkRatio) : NEUTRAL,
    image ? clamp01(image.contrast) : NEUTRAL,
    image ? clamp01(image.edgeDensity) : NEUTRAL,
    image ? clamp01(image.quadFill) : NEUTRAL,
    clamp01((input.pageCount ?? 1) / 6),
  ];
}
