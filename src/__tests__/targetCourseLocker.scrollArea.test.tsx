import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { TargetCourseLocker } from "../components/custom/exams/FFCS/components/TargetCourseLocker";
import type { CourseLock, ParsedCourse } from "../components/custom/exams/FFCS/types";
import { installLocalStorage } from "./helpers/localStorage";

installLocalStorage();

/**
 * Where the locker's faculty list scrolls.
 *
 * The same list renders in two homes that need opposite height behaviour:
 *
 * - the target course page (default `scrollArea="page"`): the list grows with
 *   its content and the page scrolls it. On a phone this is the whole screen —
 *   the list used to be squeezed into a `max-h-60` inner scroll box, which is
 *   what the page-mode default removes.
 * - the classic-mode mobile BottomSheet (`scrollArea="sheet"`): the panel has
 *   to stay inside the sheet, so the list keeps its own capped scroll area.
 *
 * jsdom computes no styles, so the classes are the contract these cases pin.
 */
vi.mock("@/lib/vitfacService", () => {
  return {
    ENABLE_VITFAC_INTEGRATION: true,
    VITFAC_WORKER_BASE: "https://vitfac.amazecc.com",
    getFacultyReview: () => null,
    useVitfacReview: () => ({ review: null, loading: false }),
    // Avatar image sources: no network in these tests.
    useCachedImage: () => null,
    useChennaiImage: () => null,
    loadVitfacCatalog: () => Promise.resolve(new Map()),
    getFacultyProfileBundle: () => Promise.resolve(null),
    getVitfacProfileUrl: () => "https://vitfac.amazecc.com",
  };
});

const masterCourses = [
  {
    CODE: "CSE101",
    TITLE: "Demo Course",
    TYPE: "TH",
    CREDITS: "3",
    FACULTY: "Dr Someone",
    SLOT: "A1+TA1",
    ROOM: "AP-101",
    ERP_ID: "111",
    CLASS_ID: "cls-111",
  } as unknown as ParsedCourse,
];

const selection: CourseLock = {
  code: "CSE101",
  title: "Demo Course",
  allowedSlots: [],
  allowedFaculty: [],
  offerings: [],
};

/** The list container: the parent of the (single) faculty group section. */
const offeringList = (): HTMLElement => {
  const section = document.querySelector('[aria-label="Offerings by Dr Someone"]');
  expect(section).not.toBeNull();
  return section?.parentElement as HTMLElement;
};

const renderLocker = (scrollArea?: "page" | "sheet") =>
  render(
    <TargetCourseLocker
      course={{ code: "CSE101", title: "Demo Course" }}
      masterCourses={masterCourses}
      selection={selection}
      onChange={() => {}}
      scrollArea={scrollArea}
    />,
  );

afterEach(cleanup);

describe("TargetCourseLocker scroll area", () => {
  it("leaves the faculty list uncapped on the target course page", () => {
    renderLocker();

    const list = offeringList();
    expect(list.className).toContain("bg-surface/50");
    // No height cap, no inner scroll: the list expands and the page scrolls.
    expect(list.className).not.toContain("max-h-60");
    expect(list.className).not.toContain("overflow-y-auto");
  });

  it("keeps the list in its own capped scroll area inside a sheet", () => {
    renderLocker("sheet");

    const list = offeringList();
    expect(list.className).toContain("max-h-60");
    expect(list.className).toContain("overflow-y-auto");
    // The desktop breakpoint still un-caps it, as before.
    expect(list.className).toContain("lg:max-h-none");
    expect(list.className).toContain("lg:overflow-visible");
  });
});
