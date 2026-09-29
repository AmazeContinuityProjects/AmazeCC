/**
 * Exam series names, canonicalised.
 *
 * The same series reaches this app spelled several ways. The academic calendar
 * writes `"CAT - II"`, the exam schedule has been seen with both `"CAT II"` and
 * `"CAT2"` as keys, and a milestone can turn up as `"Continuous Assessment
 * Test 2"`. All of them name one thing.
 *
 * Left alone, that produces two visible events for one exam: a milestone row
 * reading "CAT II" beside a paper row reading "CAT2". The cause is the
 * punctuation, because stripping `"- "` from `"CAT - II"` leaves `"cat   ii"`
 * with three spaces, and every name is compared as a substring.
 *
 * So: lowercase, strip punctuation, collapse whitespace, rewrite the numeral to
 * an arabic digit, and drop all remaining spaces. `"CAT - II"`, `"CAT II"`,
 * `"CAT-2"`, `"CAT2"` and `"CATII"` all land on `"cat2"`.
 *
 * Self-contained on purpose — `analyzeCalendar` and `calendarDay` both need it
 * and neither should have to import the other to get it.
 */

const ROMAN: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
};

/**
 * Lower-case, strip punctuation, collapse whitespace.
 *
 * The one normaliser. `analyzeCalendar.normalize` is this function under its
 * older name, because every holiday and day-type keyword is matched against the
 * output and two copies of a rule that decides whether a working day is a day
 * off is two chances to disagree.
 */
export function looseNormalise(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalSeriesName(raw: string): string {
  let s = looseNormalise(raw);
  if (!s) return "";

  // A standalone roman numeral: "cat i" -> "cat 1".
  s = s.replace(/\b(iii|ii|iv|i|v)\b/g, (m) => ROMAN[m] ?? m);

  // An attached one: "catii" -> "cat2". Only runs of two or more, so a word
  // that merely ends in "i" ("aarti") is left alone.
  s = s.replace(/([a-z])(iii|ii|iv)$/, (_m, head: string, run: string) => head + (ROMAN[run] ?? run));

  return s.replace(/\s+/g, "");
}

/** Whether two spellings name the same series. */
export function sameSeries(a: string, b: string): boolean {
  const ca = canonicalSeriesName(a);
  return !!ca && ca === canonicalSeriesName(b);
}

/**
 * The longest canonical name that is a substring of `text`.
 *
 * Length-wins rather than first-wins. `"cat1"` is not a substring of `"cat2"`,
 * so the CAT I / CAT II collision that a plain scan gets wrong cannot happen
 * here — but `"lidforlab"` is a substring of `"lidforlaboratoryclasses"`, and
 * the specific one is the correct answer.
 */
export function longestCanonicalMatch(text: string, candidates: string[]): string | null {
  const t = canonicalSeriesName(text);
  if (!t) return null;
  let best: string | null = null;
  let bestLen = 0;
  for (const candidate of candidates) {
    const c = canonicalSeriesName(candidate);
    if (c && t.includes(c) && c.length > bestLen) {
      best = candidate;
      bestLen = c.length;
    }
  }
  return best;
}
