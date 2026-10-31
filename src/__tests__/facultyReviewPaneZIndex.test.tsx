import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SlotFacultySwapSheet from "../components/custom/exams/FFCS/components/SlotFacultySwapSheet";
import type { AddedCourse, ParsedCourse } from "../components/custom/exams/FFCS/types";
import { installLocalStorage } from "./helpers/localStorage";

const storage = installLocalStorage();

/**
 * The vitfac review pane's stacking, from the pane that summons it.
 *
 * The review pane is opened by pills that live inside many surfaces of the
 * FFCS screens — the planner's page, its slot-search sheet (z-400), its
 * variant-search sheet (z-500), and the "Switch Faculty" pane (z-455) that
 * lists the other courses' offerings for a slot. It used to hard-code a
 * z-320, so from every pane above that rung it opened *behind* the pane that
 * summoned it and the tap looked dead. It now sits at the top of the app's
 * sheet ladder (which tops out at the z-600 Advanced Course Linker).
 *
 * What is pinned here, from the worst offender — the swap pane, which is
 * itself a courses' pane:
 *
 * - the review pane renders above the pane that summoned it, and its backdrop
 *   dims that pane rather than hiding under it;
 * - it renders above the ladder's top rung too, so *any* pane's pills reach
 *   it, not just panes below a certain height.
 *
 * jsdom computes no styles, so the inline z-indexes BottomSheet writes are
 * the contract under test.
 */
vi.mock("@/lib/vitfacService", () => {
  const REVIEWS: Record<string, { wPct: number; reviews: number }> = {
    "55123": { wPct: 85, reviews: 12 }, // SHINY E — the only reviewed offering
  };
  const reviewFor = (employeeId?: string | null) => {
    const hit = employeeId ? REVIEWS[String(employeeId)] : undefined;
    return hit ? { ...hit, lecture: 3, da: 3, vibe: 3, id: "", name: "" } : null;
  };
  return {
    ENABLE_VITFAC_INTEGRATION: true,
    VITFAC_WORKER_BASE: "https://vitfac.amazecc.com",
    getFacultyReview: ({ employeeId }: { employeeId?: string | null }) => reviewFor(employeeId),
    useVitfacReview: (employeeId?: string | null) => ({ review: reviewFor(employeeId), loading: false }),
    useCachedImage: () => null,
    useChennaiImage: () => null,
    loadVitfacCatalog: () => Promise.resolve(new Map()),
    getFacultyProfileBundle: () => Promise.resolve(null),
    getVitfacProfileUrl: () => "https://vitfac.amazecc.com",
  };
});

afterEach(() => {
  try {
    storage?.clear();
  } catch {}
  cleanup();
});

const course = (over: Partial<ParsedCourse> = {}): ParsedCourse =>
  ({
    CODE: "BACSE104",
    TITLE: "Object Oriented Analysis And Design",
    TYPE: "ETH+ELA",
    CREDITS: "4",
    ROOM: "AB1-212",
    SLOT: "G1+L31+L32",
    FACULTY: "AARTHI D",
    ...over,
  }) as unknown as ParsedCourse;

const half: AddedCourse = {
  id: "half-1",
  code: "BACSE104",
  title: "Object Oriented Analysis And Design",
  faculty: "AARTHI D",
  employeeId: "54969",
  venue: "AB1-101",
  slots: ["G1"],
  credits: "3",
  type: "Embedded Theory",
  color: "bg-amber-500",
};

/** Render the swap pane at a given rung and open the review pane from a pill. */
const openReviewFromSwapPane = async (panelZIndex: number, backdropZIndex: number) => {
  render(
    <SlotFacultySwapSheet
      code="BACSE104"
      courseTitle="Object Oriented Analysis And Design"
      halves={[half]}
      masterCourses={[course({ FACULTY: "SHINY E", ERP_ID: "55123", ROOM: "AB1-212" })]}
      onClose={() => {}}
      panelZIndex={panelZIndex}
      backdropZIndex={backdropZIndex}
    />,
  );
  fireEvent.click(screen.getByTitle(/^vitfac rating/));
  // The review sheet loads on demand through the host's dynamic import.
  await screen.findByText("Community Rating");
};

/** z-indexes BottomSheet wrote inline, per portal surface. */
const zIndexOf = (surface: HTMLElement) => Number(surface.style.zIndex);

const panels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-prevent-swipe]"));

const panelByText = (text: string) => panels().find((p) => p.textContent?.includes(text));

const backdrops = () =>
  Array.from(document.querySelectorAll<HTMLElement>("div")).filter(
    (d) => typeof d.className === "string" && d.className.includes("bg-black/45"),
  );

describe("faculty review pane stacking", () => {
  it("opens above the Switch Faculty pane that summoned it, backdrop included", async () => {
    // The planner's rung for the "Faculty in this Slot" pane.
    await openReviewFromSwapPane(455, 450);

    const swapPane = panelByText("Faculty in this Slot");
    const reviewPane = panelByText("Community Rating");
    expect(swapPane).toBeTruthy();
    expect(reviewPane).toBeTruthy();
    expect(zIndexOf(swapPane!)).toBe(455);
    // The pane opens above the one that summoned it — this is the regression:
    // a z-320 review pane hid behind the z-455 swap pane.
    expect(zIndexOf(reviewPane!)).toBeGreaterThan(zIndexOf(swapPane!));
    // Its backdrop dims the summoning pane instead of sliding under it, so the
    // pane behind stays visibly part of the stack it was summoned from.
    const reviewBackdrop = Math.max(...backdrops().map(zIndexOf));
    expect(reviewBackdrop).toBeGreaterThan(zIndexOf(swapPane!));
    expect(reviewBackdrop).toBeLessThan(zIndexOf(reviewPane!));
  });

  it("opens above the ladder's top rung, so any pane's pills reach it", async () => {
    // The highest sheet in the app is the z-600 Advanced Course Linker. A
    // review pane summoned from a pane that high must still land on top, so
    // the guarantee is "above every pane", not "above the pane I happened to
    // test with".
    await openReviewFromSwapPane(600, 595);

    const hostPane = panelByText("Faculty in this Slot");
    const reviewPane = panelByText("Community Rating");
    expect(zIndexOf(hostPane!)).toBe(600);
    expect(zIndexOf(reviewPane!)).toBeGreaterThan(600);
  });
});
