import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CourseCatalogFilters } from "../components/custom/exams/FFCS/components/CourseCatalogFilters";
import { buildCurriculumIndex, buildSlotIndex } from "../lib/ffcsCatalogFilters";
import type { CategoryDetail } from "../lib/curriculum";

const slotIndex = buildSlotIndex([
  { CODE: "BCSE101", SLOT: "D1+TD1" },
  { CODE: "BCSE102", SLOT: "L1+L2" },
]);

const curriculum = buildCurriculumIndex([
  {
    code: "UC",
    name: "University Core Courses",
    baskets: [{ title: "b", credits: 3, items: [{ code: "BCSE101", name: "x", credits: 3 }] }],
  },
] as CategoryDetail[]);

type Handlers = {
  onSlotsChange: ReturnType<typeof vi.fn<(next: string[]) => void>>;
  onCurriculumOnlyChange: ReturnType<typeof vi.fn<(next: boolean) => void>>;
  onCategoriesChange: ReturnType<typeof vi.fn<(next: string[]) => void>>;
};

function renderFilters(overrides: Partial<React.ComponentProps<typeof CourseCatalogFilters>> = {}): Handlers {
  const handlers: Handlers = {
    onSlotsChange: vi.fn<(next: string[]) => void>(),
    onCurriculumOnlyChange: vi.fn<(next: boolean) => void>(),
    onCategoriesChange: vi.fn<(next: string[]) => void>(),
  };
  render(
    <CourseCatalogFilters
      slotIndex={slotIndex}
      slots={[]}
      curriculum={null}
      curriculumOnly={false}
      categories={[]}
      {...overrides}
      {...handlers}
    />,
  );
  return handlers;
}

afterEach(cleanup);

describe("CourseCatalogFilters", () => {
  it("keeps the chip wall collapsed until asked, then offers the catalogue's slots", () => {
    renderFilters();

    expect(screen.queryByRole("button", { name: "D1" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Filter by slot/ }));
    expect(screen.getByRole("button", { name: "D1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "TD1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "L1" })).toBeDefined();
  });

  it("emits slot toggles and carries the active count on the toggle", () => {
    const handlers = renderFilters({ slots: ["D1"] });

    // The collapsed toggle carries the count while the wall stays shut.
    expect(screen.getByRole("button", { name: /Slots · 1/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: "D1" })).toBeNull();

    // Open it and the selected chip reports itself as pressed.
    fireEvent.click(screen.getByRole("button", { name: /Slots · 1/ }));
    expect(screen.getByRole("button", { name: "D1" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Clear slots" }));
    expect(handlers.onSlotsChange).toHaveBeenCalledWith([]);
  });

  it("hides the curriculum switch when there is no curriculum to match", () => {
    renderFilters({ curriculum: null });

    expect(screen.queryByRole("switch", { name: "Only show courses from my curriculum" })).toBeNull();
  });

  it("reveals category chips behind the curriculum switch", () => {
    const handlers = renderFilters({
      curriculum,
      curriculumOnly: false,
      categories: [],
    });

    // Off: the switch exists, the category row does not.
    expect(screen.getByRole("switch", { name: "Only show courses from my curriculum" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "University Core Courses" })).toBeNull();

    fireEvent.click(screen.getByRole("switch", { name: "Only show courses from my curriculum" }));
    expect(handlers.onCurriculumOnlyChange).toHaveBeenCalledWith(true);

    // On (controlled): the category row appears with All preselected.
    cleanup();
    const handlersOn = renderFilters({ curriculum, curriculumOnly: true, categories: [] });
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "University Core Courses" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "University Core Courses" }));
    expect(handlersOn.onCategoriesChange).toHaveBeenCalledWith(["University Core Courses"]);
  });
});
