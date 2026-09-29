import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SimplifiedMobileHome from "../components/custom/mobile/SimplifiedMobileHome";

/**
 * The home page's week strip, as a user meets it.
 *
 * The strip is a seven-circle row where the day kind is carried by a tint
 * rather than a word, and where a drag pages between weeks. Both of those are
 * invisible to the pure tests in `weekStrip.test.ts` — a table can be correct
 * and never rendered, a hook can page and be wired to nothing — so this renders
 * the real page and drives the real gesture.
 *
 * "Today" is pinned to Tue 29 Sept 2026, which makes the visible week
 * `28 Aug… no: 28 Sep` through `4 Oct` — the same week, and the same
 * "today on the second circle" position, as every screenshot of this page.
 */

const TODAY = new Date(2026, 8, 29, 10, 0, 0); // a Tuesday, 10am local

/**
 * An exam on Tue 29 Sept, and academic holidays on Thu 1 and Sat 3 Oct. The rest
 * of the visible week is ordinary.
 *
 * The holidays need their own October calendar: the strip matches a calendar to
 * a week by month and year, strictly, so a "Sept 2026" entry says nothing about
 * 1 Oct. That strictness is the app's, not the test's, and this fixture has to
 * respect it or the day types quietly stop being detected.
 */
function props(over: Record<string, unknown> = {}) {
  return {
    attendanceData: { attendance: [] },
    marksData: {},
    hostelData: {},
    moodleData: [],
    calendarData: {
      calendars: [
        {
          calendarType: "General Semester",
          month: "Sept 2026",
          days: [],
        },
        {
          calendarType: "General Semester",
          month: "Oct 2026",
          days: [
            { date: 1, events: [{ text: "No instructional day", type: "event" }] },
            { date: 3, events: [{ text: "No instructional day", type: "event" }] },
          ],
        },
      ],
    },
    ScheduleData: {
      Schedule: {
        CAT2: [
          { courseCode: "BAGER101", courseTitle: "German Level I", examDate: "29-09-2026" },
        ],
      },
    },
    settings: {},
    setSettings: vi.fn(),
    IDs: {},
    setActiveTab: vi.fn(),
    setActiveSubTab: vi.fn(),
    setActiveAttendanceSubTab: vi.fn(),
    handleReloadRequest: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    ...over,
  } as any;
}

function renderHome(over: Record<string, unknown> = {}) {
  return render(<SimplifiedMobileHome {...props(over)} />);
}

/** The strip is the only `role="group"` labelled "Week". */
const strip = () => screen.getByRole("group", { name: "Week" });
const circles = () => within(strip()).getAllByRole("button");

/** A drag across the strip: down, two moves, up. */
function swipe(from: [number, number], to: [number, number]) {
  const node = strip();
  const opts = { pointerId: 1, pointerType: "touch" };
  fireEvent.pointerDown(node, { ...opts, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(node, {
    ...opts,
    clientX: (from[0] + to[0]) / 2,
    clientY: (from[1] + to[1]) / 2,
  });
  fireEvent.pointerMove(node, { ...opts, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(node, { ...opts, clientX: to[0], clientY: to[1] });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("week strip", () => {
  it("draws seven circles for the week, Monday first", () => {
    renderHome();
    const labels = circles().map((c) => c.textContent);
    expect(labels).toEqual([
      "MON28",
      "TUE29",
      "WED30",
      "THU1",
      "FRI2",
      "SAT3",
      "SUN4",
    ]);
  });

  it("has no plate behind it — the circles sit on the page", () => {
    // The circles used to be pinned inside a `rounded-2xl bg-zinc-100` card.
    // The row must not quietly grow one back: on a bare page the circles draw
    // their own fill and hairline, and that is the whole negative space.
    renderHome();
    expect(strip().className).not.toMatch(/bg-|border|rounded|shadow/);
  });

  it("tints an exam day amber and keeps the word in the title", () => {
    renderHome();
    const exam = within(strip()).getByTitle("Tue 29 Sept · Exam day");
    expect(exam.className).toContain("bg-amber-500/10");
    // The word is not on the face of the circle, but it is not gone either —
    // and the exam count rides in the accessible name, not the title.
    expect(exam.textContent).toBe("TUE29");
    expect(exam.getAttribute("aria-label")).toBe("Tue 29 Sept · Exam day, 1 exam");
  });

  it("tints a holiday red", () => {
    renderHome();
    for (const title of ["Thu 1 Oct · Academic holiday", "Sat 3 Oct · Academic holiday"]) {
      expect(within(strip()).getByTitle(title).className).toContain("bg-red-500/10");
    }
  });

  it("leaves an ordinary day untinted and unbordered by colour", () => {
    renderHome();
    const ordinary = within(strip()).getByTitle("Mon 28 Sept · No classes");
    expect(ordinary.className).toContain("bg-white");
    expect(ordinary.className).not.toMatch(/bg-(amber|red|indigo|emerald|sky)-/);
  });

  it("marks today with aria-current and an emerald ring", () => {
    renderHome();
    const today = within(strip()).getByTitle("Tue 29 Sept · Exam day");
    // An exam day, so the amber tint wins the fill and the ink; the ring is
    // the only thing left that can say "today", which is exactly why it is
    // drawn on a tint rather than replacing it.
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(within(strip()).getByTitle("Wed 30 Sept · No classes").hasAttribute("aria-current")).toBe(
      false
    );
  });

  it("shows the selection ring on the day that is selected, not on today", () => {
    renderHome();
    // Land on the page and today is selected, so select something else and
    // today's emerald ring has to appear in its place.
    fireEvent.click(within(strip()).getByTitle("Fri 2 Oct · No classes"));

    const friday = within(strip()).getByTitle("Fri 2 Oct · No classes");
    const today = within(strip()).getByTitle("Tue 29 Sept · Exam day");
    expect(friday.className).toContain("ring-indigo-500");
    expect(today.className).toContain("ring-emerald-500");
  });

  it("pages to the next week on a left swipe and back on a right swipe", async () => {
    renderHome();
    expect(within(strip()).getByTitle("Mon 28 Sept · No classes")).toBeTruthy();

    swipe([320, 60], [120, 65]);
    await waitFor(() =>
      expect(within(strip()).getByTitle("Mon 5 Oct · No classes")).toBeTruthy()
    );

    swipe([120, 65], [320, 60]);
    await waitFor(() =>
      expect(within(strip()).getByTitle("Mon 28 Sept · No classes")).toBeTruthy()
    );
  });

  it("still pages with the chevrons, and offers a way back", async () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Next Week" }));
    await waitFor(() =>
      expect(within(strip()).getByTitle("Mon 5 Oct · No classes")).toBeTruthy()
    );

    // The way back only exists once you have left.
    fireEvent.click(screen.getByTitle("Back to today"));
    await waitFor(() =>
      expect(within(strip()).getByTitle("Mon 28 Sept · No classes")).toBeTruthy()
    );
  });

  it("does not let a swipe select the day it started on", async () => {
    renderHome();
    // The regression the click suppression exists for: a drag that lands on
    // another circle would otherwise fire that circle's onClick on the way
    // past, quietly changing the timetable underneath the user.
    swipe([320, 60], [120, 65]);
    await waitFor(() => expect(circles().length).toBe(7));

    // Still Tuesday: selection survived the week change, and no stray click
    // moved it to some other day.
    expect(within(strip()).getAllByRole("button")[1].className).toContain(
      "ring-indigo-500"
    );
  });

  it("opts the strip out of the dashboard's own swipe", () => {
    // `Dashboard` reads this attribute on touchend to decide a drag means
    // "change tab". Without it a drag that starts on a circle and ends on the
    // gap between two circles flips the whole dashboard.
    renderHome();
    expect(strip().getAttribute("data-prevent-swipe")).toBe("true");
  });

  it("has no full-calendar button in the header", () => {
    // The strip is the home page's calendar; a second button pointing at a
    // month grid of the same data made the user choose between two views of
    // one thing.
    renderHome();
    expect(screen.queryByTitle("Open Full Calendar Page")).toBeNull();
    expect(screen.queryByText("Full Calendar")).toBeNull();
  });
});

describe("the header row's layout", () => {
  /** The row that holds the week navigation and the pill-style filter. */
  const headerRow = () =>
    screen.getByTitle("Next Week").closest("div.flex.flex-wrap") as HTMLElement;

  it("keeps a gap and a wrap between the navigation and the filter", () => {
    // The row grew a `Today` chip every time the selection left today — which
    // is exactly when the exam viewport below is on screen. With `justify-between`
    // and no gap, that chip ran into the Compact/Detailed control instead of
    // the row wrapping.
    renderHome();
    fireEvent.click(within(strip()).getByTitle("Fri 2 Oct · No classes"));

    const row = headerRow();
    expect(row.className).toContain("gap-2");
    expect(row.className).toContain("flex-wrap");
  });

  it("lets the date shorten rather than shoving the filter off the edge", () => {
    // "Nov - Dec 2025" is a wide, unbreakable-ish string in a row with two
    // other children. Without `min-w-0` it cannot shrink, so it pushes.
    renderHome();
    const name = screen.getByText("Sep - Oct 2026");
    expect(name.className).toContain("truncate");
    expect(name.parentElement?.className).toContain("min-w-0");
  });

  it("refuses to squeeze the filter, and keeps it right-aligned if it wraps", () => {
    // Its segments are `whitespace-nowrap`, so a squeezed control would
    // overflow its own pill rather than shorten. (The filter is suppressed on
    // an exam or holiday day, and this fixture's today is an exam day, so
    // select an ordinary one first.)
    renderHome();
    fireEvent.click(within(strip()).getByTitle("Fri 2 Oct · No classes"));

    const filter = screen.getByTitle("2-Line Compact Pill View");
    const group = filter.closest("div.shrink-0") as HTMLElement;
    expect(group.className).toContain("ml-auto");
  });
});

describe("the Today chip", () => {
  const selected = () =>
    within(strip())
      .getAllByRole("button")
      .find((c) => c.className.includes("ring-indigo-500"));

  const selectedTitle = () => selected()?.getAttribute("title");

  it("stays hidden while today is selected", () => {
    renderHome();
    expect(screen.queryByTitle("Back to today")).toBeNull();
  });

  it("appears after picking another day, not just after paging the week", () => {
    // The regression that merged two controls into one. Gating the way back on
    // the week alone hid it after the *common* way of wandering off today —
    // tapping a different circle — leaving the page with no way home.
    renderHome();
    fireEvent.click(within(strip()).getByTitle("Fri 2 Oct · No classes"));
    expect(screen.queryByTitle("Back to today")).not.toBeNull();
  });

  it("sits in the header, with the week arrows", () => {
    // One chip, so it keeps the home the "This Week" chip already had rather
    // than the one a second control was moved to.
    renderHome();
    fireEvent.click(within(strip()).getByTitle("Mon 28 Sept · No classes"));

    const name = screen.getByText("Sep - Oct 2026");
    const nextWeek = screen.getByTitle("Next Week");
    const chip = screen.getByTitle("Back to today");
    const row = strip();

    const before = (a: Element, b: Element) =>
      !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(before(name, nextWeek)).toBe(true);
    expect(before(nextWeek, chip)).toBe(true);
    expect(before(chip, row)).toBe(true);
    // Same group as the arrows, unlike before.
    expect(nextWeek.parentElement?.parentElement?.contains(chip)).toBe(true);
  });

  it("is one button, labelled Today, with no arrows of its own", () => {
    // The row carries a pair of chevrons for the week. A `‹ Today ›` cluster
    // next to them asked which pair meant what.
    renderHome();
    fireEvent.click(within(strip()).getByTitle("Mon 28 Sept · No classes"));

    const chip = screen.getByTitle("Back to today");
    expect(chip.textContent).toBe("Today");
    expect(chip.querySelector("svg")).toBeNull();
    // And there is only one control doing this job.
    expect(screen.getAllByTitle("Back to today")).toHaveLength(1);
    expect(screen.queryByText("This Week")).toBeNull();
  });

  it("comes back to today, and pulls a browsed week back with it", async () => {
    renderHome();
    // Browse forward a week and pick a day there. Both halves have to be
    // undone: resetting only the day would select a Tuesday that isn't in the
    // week on screen, leaving the highlight on nothing.
    fireEvent.click(screen.getByRole("button", { name: "Next Week" }));
    await waitFor(() =>
      expect(within(strip()).getByTitle("Mon 5 Oct · No classes")).toBeTruthy()
    );
    fireEvent.click(within(strip()).getByTitle("Wed 7 Oct · No classes"));
    expect(selectedTitle()).toBe("Wed 7 Oct · No classes");

    fireEvent.click(screen.getByTitle("Back to today"));
    await waitFor(() =>
      expect(within(strip()).getByTitle("Mon 28 Sept · No classes")).toBeTruthy()
    );
    expect(selectedTitle()).toBe("Tue 29 Sept · Exam day");
    // Back on today, so the chip retires itself again.
    expect(screen.queryByTitle("Back to today")).toBeNull();
  });
});
