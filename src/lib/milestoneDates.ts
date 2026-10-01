import { analyzeAllCalendars } from "./analyzeCalendar";

/**
 * The four dates the attendance predictor projects against.
 *
 * Three surfaces render that screen — the Dashboard attendance tab, the weekly
 * attendance tab's Predictor button, and Tools → Attendance Predictor — and each
 * one used to build this object itself. Two did it by substring-matching the
 * milestone's display string (`"cat i"` is also a substring of `"CAT II"`, so
 * which exam a date belonged to came down to calendar order) and one by exact
 * string equality against the display name, which only worked because the
 * literals happened to match the casing `IMPORTANT_EVENTS` writes.
 *
 * All three now read the map by its canonical key, which is what
 * `matchImportantEvent` indexed it under. One copy, no string matching.
 */
export type MilestoneDateSet = {
  cat1Date: Date | null;
  cat2Date: Date | null;
  lidLabDate: Date | null;
  lidTheoryDate: Date | null;
};

export type AnalyzedCalendars = {
  /** The per-month results the predictor reads working days from. */
  results: any[];
  impDates: MilestoneDateSet;
  /** The raw `importantEvents` map, for anything that wants a milestone blurb. */
  importantEvents: Map<string, any>;
};

const EMPTY: MilestoneDateSet = {
  cat1Date: null,
  cat2Date: null,
  lidLabDate: null,
  lidTheoryDate: null,
};

/**
 * Analyse a raw `/api/calendar` payload and pull the milestone dates out of it.
 *
 * Tolerant of every shape this is called with: no payload, no `calendars` key,
 * an empty object, or a calendar whose months carry no milestones at all. A
 * student whose calendar has not loaded gets `null` for every date, which the
 * predictor reads as "no ceiling and no lock" rather than as an error.
 */
export function buildMilestoneDates(calendarData: any): AnalyzedCalendars {
  const calendars = calendarData?.calendars;
  if (!Array.isArray(calendars) || calendars.length === 0) {
    return { results: [], impDates: { ...EMPTY }, importantEvents: new Map() };
  }

  const analysis = analyzeAllCalendars(calendars);
  const events = analysis.importantEvents;
  const dateOf = (key: string): Date | null => events.get(key)?.formattedDate ?? null;

  return {
    results: analysis.results,
    importantEvents: events,
    impDates: {
      cat1Date: dateOf("cat i"),
      cat2Date: dateOf("cat ii"),
      lidLabDate: dateOf("lid for laboratory classes"),
      lidTheoryDate: dateOf("lid for theory classes"),
    },
  };
}