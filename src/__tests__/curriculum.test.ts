import { describe, expect, it } from "vitest";
import {
  buildCategoryRows,
  buildBasketMap,
  splitCurriculumRows,
  num,
  type CategoryDetail,
  type CurriculumCategory,
  type CurriculumRow,
} from "../lib/curriculum";

const details: CategoryDetail[] = [
  {
    code: "FC",
    name: "Foundation Core",
    baskets: [
      { title: "Mathematics", credits: 18, items: [{ code: "BCSE101M", name: "Maths", credits: 3 }] },
    ],
  },
  {
    code: "PC",
    name: "Professional Core",
    baskets: [
      { title: "Systems", credits: 24, items: [{ code: "BCSE203E", name: "Embedded", credits: 3 }] },
    ],
  },
];

const curriculum: CurriculumRow[] = [
  { basketTitle: "Foundation Core", creditsRequired: "20", creditsEarned: "18" },
  { basketTitle: "Professional Core", creditsRequired: "60", creditsEarned: "30" },
  { basketTitle: "Foreign Language", creditsRequired: "4", creditsEarned: "2" },
  { basketTitle: "Total Credits", creditsRequired: "160", creditsEarned: "100" },
];

describe("curriculum row derivation", () => {
  it("drops the Total Credits row and splits out elective baskets", () => {
    const { main, sub } = splitCurriculumRows(curriculum);
    expect(main.map((c) => c.basketTitle)).toEqual([
      "Foundation Core",
      "Professional Core",
    ]);
    expect(sub.map((c) => c.basketTitle)).toEqual(["Foreign Language"]);
  });

  it("builds rows from the flat curriculum list (primary source)", () => {
    const rows = buildCategoryRows({
      curriculum,
      categories: [],
      details,
      ongoingByCategory: { "Professional Core": 9 },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: "cur:Foundation Core",
      title: "Foundation Core",
      earned: 18,
      required: 20,
      ongoing: 0,
    });
    // baskets joined by category name
    expect(rows[0].baskets[0].title).toBe("Mathematics");
    expect(rows[1].ongoing).toBe(9);
    // no code chip on this source
    expect(rows[0].code).toBeUndefined();
  });

  it("falls back to the categories array when curriculum is empty", () => {
    // This is the regression: accounts without a flat `curriculum` list still
    // have `categories`, and the baskets must still render.
    const categories: CurriculumCategory[] = [
      { code: "FC", name: "Foundation Core", credits: 18, maxCredits: 20 },
      { code: "PC", name: "Professional Core", credits: 30, maxCredits: 60 },
    ];
    const rows = buildCategoryRows({
      curriculum: [],
      categories,
      details,
      ongoingByCategory: {},
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: "cat:FC",
      code: "FC",
      title: "Foundation Core",
      earned: 18,
      required: 20,
    });
    // baskets resolved via the details `code` join
    expect(rows[0].baskets[0].title).toBe("Mathematics");
    expect(rows[1].baskets[0].title).toBe("Systems");
  });

  it("returns nothing when both sources are empty", () => {
    expect(
      buildCategoryRows({ curriculum: [], categories: [], details: null, ongoingByCategory: {} })
    ).toEqual([]);
  });

  it("never divides by a zero requirement", () => {
    const rows = buildCategoryRows({
      curriculum: [{ basketTitle: "Odd", creditsRequired: "0", creditsEarned: "0" }],
      categories: [],
      details: null,
      ongoingByCategory: {},
    });
    expect(rows[0].required).toBe(1);

    const fallback = buildCategoryRows({
      curriculum: [],
      categories: [{ code: "X", name: "Odd", credits: 0, maxCredits: 0 }],
      details: null,
      ongoingByCategory: {},
    });
    expect(fallback[0].required).toBe(1);
  });

  it("tolerates a category with no matching detail entry", () => {
    const rows = buildCategoryRows({
      curriculum: [],
      categories: [{ code: "ZZ", name: "Unknown", credits: 3, maxCredits: 4 }],
      details,
      ongoingByCategory: {},
    });
    expect(rows[0].baskets).toEqual([]);
  });

  it("maps details to baskets by category name", () => {
    const map = buildBasketMap(details);
    expect(map.get("Foundation Core")).toHaveLength(1);
    expect(map.get("Nope")).toBeUndefined();
  });

  it("num coerces junk to a fallback", () => {
    expect(num("18.5")).toBe(18.5);
    expect(num(undefined)).toBe(0);
    expect(num("abc", 7)).toBe(7);
  });
});
