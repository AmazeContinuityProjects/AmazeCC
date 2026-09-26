/**
 * Pure derivations for the Curriculum page.
 *
 * These live outside the component on purpose: the category rows have two
 * possible data sources (the flat all-grades `curriculum` list, or the
 * `categories` array from the /curriculum response) and picking the wrong one
 * renders an empty page. Keeping it here makes it unit-testable.
 */

export interface CurriculumRow {
  basketTitle: string;
  creditsRequired: string;
  creditsEarned: string;
}

export interface EffectiveGradeRow {
  basketTitle: string;
  distributionType: string;
  creditsEarned: string;
  grade: string;
  courseCode?: string;
}

export interface BasketCourse {
  code: string;
  name: string;
  credits: number;
  type?: string;
}

export interface Basket {
  title: string;
  credits: number;
  items: BasketCourse[];
}

export interface CurriculumCategory {
  code: string;
  name: string;
  credits: number;
  maxCredits: number;
}

export interface CategoryDetail {
  code: string;
  name: string;
  baskets: Basket[];
}

export const SPECIAL_BASKETS = [
  "Extra curricular activities",
  "HSM Elective",
  "Foreign Language",
];

export const num = (v: unknown, fallback = 0): number => {
  const n = parseFloat(String(v ?? ""));
  return isNaN(n) ? fallback : n;
};

const isTotalRow = (row: CurriculumRow) =>
  (row.basketTitle || "").toLowerCase().includes("total credits");

const isSpecial = (title: string) =>
  SPECIAL_BASKETS.some((b) => (title || "").toLowerCase().includes(b.toLowerCase()));

/** Drops the synthetic "Total Credits" row and splits out elective baskets. */
export function splitCurriculumRows(curriculum: CurriculumRow[]): {
  main: CurriculumRow[];
  sub: CurriculumRow[];
} {
  const withoutTotal = curriculum.filter((c) => !isTotalRow(c));
  return {
    main: withoutTotal.filter((c) => !isSpecial(c.basketTitle)),
    sub: withoutTotal.filter((c) => isSpecial(c.basketTitle)),
  };
}

/** category name -> its baskets */
export function buildBasketMap(details: CategoryDetail[] | null): Map<string, Basket[]> {
  const map = new Map<string, Basket[]>();
  for (const cat of details || []) {
    if (!map.has(cat.name)) map.set(cat.name, []);
    for (const b of cat.baskets || []) map.get(cat.name)!.push(b);
  }
  return map;
}

export interface CategoryRow {
  key: string;
  code?: string;
  title: string;
  earned: number;
  /** Never 0 — a zero required would make the percentage meaningless */
  required: number;
  ongoing: number;
  baskets: Basket[];
}

export function buildCategoryRows({
  curriculum,
  categories,
  details,
  ongoingByCategory,
}: {
  curriculum: CurriculumRow[];
  categories: CurriculumCategory[];
  details: CategoryDetail[] | null;
  ongoingByCategory: Record<string, number>;
}): CategoryRow[] {
  const basketMap = buildBasketMap(details);
  const { main } = splitCurriculumRows(curriculum);

  // Primary source: the flat curriculum list from the all-grades payload
  if (main.length > 0) {
    return main.map((c) => {
      const required = num(c.creditsRequired);
      return {
        key: `cur:${c.basketTitle}`,
        title: c.basketTitle,
        earned: num(c.creditsEarned),
        required: required > 0 ? required : 1,
        ongoing: ongoingByCategory[c.basketTitle] || 0,
        baskets: basketMap.get(c.basketTitle) || [],
      };
    });
  }

  // Fallback: categories from the /curriculum response, matched to details by code
  return categories.map((cat) => {
    const detail = (details || []).find((d) => d.code === cat.code);
    return {
      key: `cat:${cat.code}`,
      code: cat.code,
      title: cat.name,
      earned: num(cat.credits),
      required: num(cat.maxCredits) || 1,
      ongoing: ongoingByCategory[cat.name] || 0,
      baskets: detail?.baskets || [],
    };
  });
}
