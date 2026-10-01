import { describe, it, expect } from "vitest";
import { TILE, TILE_CARD, TILE_INTERACTIVE, TILE_INTERACTIVE_ROW } from "@/lib/uiTokens";

/**
 * The surface tokens carry layout, not just paint.
 *
 * `TILE` ships `flex flex-col justify-between` so a label / value / footer can
 * be pushed apart. That makes it a COLUMN tile. A row-shaped surface — a course
 * pill, a nav card, a button that is itself a list row — cannot use it, and
 * appending `flex items-center` to `TILE_INTERACTIVE` does not fix it:
 * `flex-col` and `items-center` are different properties, so the element ends up
 * a column whose items are centred. Every subject row on the Courses & Marks
 * page rendered as a vertical stack for exactly that reason.
 *
 * These assertions lock the distinction so the bug cannot come back via a
 * "harmless" extra class.
 */

describe("surface tokens", () => {
    it("TILE is a column", () => {
        expect(TILE).toContain("flex-col");
        expect(TILE).toContain("justify-between");
    });

    it("TILE_CARD has no flex at all, so callers own the layout", () => {
        expect(TILE_CARD).not.toMatch(/\bflex\b/);
        expect(TILE_CARD).not.toContain("flex-col");
    });

    it("TILE_INTERACTIVE is a column, because it is built on TILE", () => {
        expect(TILE_INTERACTIVE).toContain("flex-col");
    });

    it("TILE_INTERACTIVE_ROW is a row and never inherits the column", () => {
        expect(TILE_INTERACTIVE_ROW).toContain("flex-row");
        expect(TILE_INTERACTIVE_ROW).not.toContain("flex-col");
    });

    it("TILE_INTERACTIVE_ROW carries the same affordance as TILE_INTERACTIVE", () => {
        // The point of TILE_INTERACTIVE was that a missed suffix reads as a dead
        // surface. The row variant must not quietly drop it.
        for (const part of ["transition-all", "hover:scale-[1.01]", "active:scale-[0.98]", "cursor-pointer"]) {
            expect(TILE_INTERACTIVE).toContain(part);
            expect(TILE_INTERACTIVE_ROW).toContain(part);
        }
    });

    it("TILE_INTERACTIVE_ROW shares the surface with the other tiles", () => {
        // Same colour and border, so a row tile and a column tile are the same
        // card rather than two different cards that happen to look similar.
        //
        // The border step is `border-border-strong`, not `border-border-muted`:
        // on a near-white surface the muted step is not readable as an edge, and a
        // card without a visible edge has no shape. See the border-step override
        // in `globals.css` for why both steps were darkened.
        for (const part of ["bg-surface", "border-border-strong", "backdrop-blur-xl", "rounded-[24px]"]) {
            expect(TILE_INTERACTIVE_ROW).toContain(part);
            expect(TILE).toContain(part);
        }
    });
});
