import { describe, expect, it } from "vitest";
import {
  EMPTY_CATALOG_FILTERS,
  buildCurriculumIndex,
  buildSlotIndex,
  canonicalSlot,
  catalogFiltersActive,
  catalogSlotChips,
  courseCategory,
  matchesCatalogFilters,
  type CatalogFilterState,
} from "../lib/ffcsCatalogFilters";
import type { CategoryDetail } from "../lib/curriculum";

const details: CategoryDetail[] = [
  {
    code: "UC",
    name: "University Core Courses",
    baskets: [
      {
        title: "Basic Sciences",
        credits: 12,
        items: [
          { code: "PHY101", name: "Physics", credits: 3 },
          { code: "CHM101", name: "Chemistry", credits: 3 },
        ],
      },
    ],
  },
  {
    code: "PC",
    name: "Programme Core Courses",
    baskets: [
      {
        title: "Discipline Core",
        credits: 24,
        items: [{ code: "BCSE101", name: "Programming", credits: 4 }],
      },
    ],
  },
  {
    code: "OE",
    name: "Open Elective",
    baskets: [{ title: "Open basket", credits: 3, items: [] }],
  },
];

const state = (over: Partial<CatalogFilterState> = {}): CatalogFilterState => ({
  ...EMPTY_CATALOG_FILTERS,
  ...over,
});

describe("buildSlotIndex", () => {
  it("merges every offering's tokens per code and drops NIL", () => {
    const index = buildSlotIndex([
      { CODE: " BCSE101 ", SLOT: "A1+TA1" },
      { CODE: "bcse101", SLOT: "L1+L2+NIL" },
      { CODE: "", SLOT: "D1" },
    ]);
    expect(index.size).toBe(1);
    expect([...(index.get("BCSE101") ?? [])].sort()).toEqual(["A1", "L1", "L2", "TA1"]);
  });
});

describe("canonicalSlot", () => {
  it("writes a law slot as the schema spells it", () => {
    expect(canonicalSlot("a")).toBe("A1");
    expect(canonicalSlot("TA")).toBe("TA1");
    expect(canonicalSlot("TEE")).toBe("S11");
    expect(canonicalSlot("S11")).toBe("S11");
  });

  it("leaves engineering spellings alone", () => {
    expect(canonicalSlot("d1")).toBe("D1");
    expect(canonicalSlot("L49")).toBe("L49");
    expect(canonicalSlot(" S1 ")).toBe("S1");
  });
});

describe("catalogSlotChips", () => {
  it("separates theory from lab, merges aliases, sorts by reading order", () => {
    const index = buildSlotIndex([
      { CODE: "X1", SLOT: "L10+L2" },
      { CODE: "Y1", SLOT: "D1" },
      { CODE: "Z1", SLOT: "A" }, // law's digit-less spelling of A1
      { CODE: "W1", SLOT: "A1" },
    ]);
    const chips = catalogSlotChips(index);
    // One A1 chip for both spellings, not an A and an A1 that mean the same slot.
    expect(chips.theory).toEqual(["A1", "D1"]);
    expect(chips.lab).toEqual(["L2", "L10"]);
  });
});

describe("buildCurriculumIndex", () => {
  it("maps upper-cased codes to their category, only counting categories with courses", () => {
    const curriculum = buildCurriculumIndex(details);
    expect(curriculum).not.toBeNull();
    // "Open Elective" has no course items and must not render a chip that
    // can only ever empty the list.
    expect(curriculum!.categories).toEqual(["University Core Courses", "Programme Core Courses"]);
    expect(courseCategory("phy101", curriculum)).toBe("University Core Courses");
    expect(courseCategory(" BCSE101 ", curriculum)).toBe("Programme Core Courses");
    expect(courseCategory("NOTIN1", curriculum)).toBeNull();
  });

  it("is null without details or without course items", () => {
    expect(buildCurriculumIndex(null)).toBeNull();
    expect(buildCurriculumIndex(undefined)).toBeNull();
    expect(buildCurriculumIndex([])).toBeNull();
    expect(buildCurriculumIndex([{ code: "X", name: "Empty", baskets: [] }])).toBeNull();
  });

  it("keeps the first category when a code appears twice", () => {
    const duplicated: CategoryDetail[] = [
      {
        code: "A",
        name: "First",
        baskets: [{ title: "b", credits: 3, items: [{ code: "PHY101", name: "p", credits: 3 }] }],
      },
      {
        code: "B",
        name: "Second",
        baskets: [{ title: "b", credits: 3, items: [{ code: "PHY101", name: "p", credits: 3 }] }],
      },
    ];
    expect(courseCategory("PHY101", buildCurriculumIndex(duplicated))).toBe("First");
  });

  it("is null for a logged-out student (no curriculum pointer)", () => {
    expect(courseCategory("PHY101", null)).toBeNull();
  });
});

describe("matchesCatalogFilters", () => {
  const curriculum = buildCurriculumIndex(details)!;

  it("passes every course when no filter is on", () => {
    expect(matchesCatalogFilters("ANY1", undefined, EMPTY_CATALOG_FILTERS, null)).toBe(true);
  });

  it("keeps a course when ANY selected chip is one of its slots", () => {
    const slots = new Set(["D1", "L1"]);
    expect(matchesCatalogFilters("X", slots, state({ slots: ["D1"] }), null)).toBe(true);
    expect(matchesCatalogFilters("X", slots, state({ slots: ["B1"] }), null)).toBe(false);
    expect(matchesCatalogFilters("X", slots, state({ slots: ["B1", "L1"] }), null)).toBe(true);
    // A course with no slots at all can never answer a slot chip.
    expect(matchesCatalogFilters("X", undefined, state({ slots: ["D1"] }), null)).toBe(false);
  });

  it("answers for law spellings through the chip", () => {
    expect(matchesCatalogFilters("TLAW101", new Set(["A", "TA"]), state({ slots: ["A1"] }), null)).toBe(true);
    expect(matchesCatalogFilters("TLAW101", new Set(["TEE"]), state({ slots: ["S11"] }), null)).toBe(true);
  });

  it("hides codes the curriculum does not list when curriculum-only is on", () => {
    expect(matchesCatalogFilters("PHY101", undefined, state({ curriculumOnly: true }), curriculum)).toBe(true);
    expect(matchesCatalogFilters("NOTIN1", undefined, state({ curriculumOnly: true }), curriculum)).toBe(false);
  });

  it("narrows to selected categories, with empty selection meaning all", () => {
    const only = state({ curriculumOnly: true });
    expect(matchesCatalogFilters("PHY101", undefined, { ...only, categories: [] }, curriculum)).toBe(true);
    expect(
      matchesCatalogFilters("PHY101", undefined, { ...only, categories: ["Programme Core Courses"] }, curriculum),
    ).toBe(false);
    expect(
      matchesCatalogFilters("BCSE101", undefined, { ...only, categories: ["Programme Core Courses"] }, curriculum),
    ).toBe(true);
  });

  it("treats a stale curriculum-only state with no curriculum as off", () => {
    // The switch cannot be on without curriculum data; a stale true means
    // the data left, not that the student asked for an empty list.
    expect(matchesCatalogFilters("ANY1", undefined, state({ curriculumOnly: true }), null)).toBe(true);
  });

  it("requires both filters when both are on", () => {
    const both = state({ slots: ["D1"], curriculumOnly: true });
    expect(matchesCatalogFilters("PHY101", new Set(["B1"]), both, curriculum)).toBe(false);
    expect(matchesCatalogFilters("PHY101", new Set(["D1"]), both, curriculum)).toBe(true);
  });

  it("reports whether the active filters narrow anything", () => {
    expect(catalogFiltersActive(EMPTY_CATALOG_FILTERS)).toBe(false);
    expect(catalogFiltersActive(state({ slots: ["D1"] }))).toBe(true);
    expect(catalogFiltersActive(state({ curriculumOnly: true }))).toBe(true);
    // Category selections only exist behind the switch.
    expect(catalogFiltersActive(state({ categories: ["Open Elective"] }))).toBe(false);
  });
});
