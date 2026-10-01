import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The direct-children shape of every converted `PageShell`.
 *
 * Converting a screen to `PageShell` means deleting the old hand-rolled root
 * `<div>` and letting the component supply the chrome. That edit is a swap of
 * opening and closing tags, and when it goes wrong it very often goes wrong in
 * a way nothing else catches: the tags still balance, so the JSX is valid, but a
 * whole section ends up nested one level too deep.
 *
 * That happened on the Courses & Marks page. Swapping a hand-rolled filter strip
 * for `ChipTabs` consumed two closing tags instead of one, which left the
 * search row unclosed — so the course list and the Academic Explorer section
 * became flex children of the search row. On `sm:flex-row` that put the list
 * beside the search field instead of under it, and the row's unbounded
 * min-content width pushed the cards past the viewport. The text still looked
 * right because `min-w-0` and `truncate` still applied inside each row.
 *
 * `tsc`, `eslint`, 918 tests and `next build` all passed. A structural-nesting
 * bug that preserves tag balance is invisible to every one of them, so it needs
 * a check that reads the tree rather than counting tags.
 *
 * The expectation is keyed by file and ordinal, not line number, so edits above
 * a page do not invalidate it. Add one entry per page as the phases land.
 *
 * Shapes:
 *   `<tag>:stack`   a vertical stack (`space-y-*`)
 *   `<tag>:row`     a horizontal row (`flex-row`)
 *   `<tag>:div`     a div with neither
 *   `<tag>:control` a self-closing primitive (ChipTabs, SectionHeader, …)
 *   `cond&&` / `ternary` / `expr` / `grouped`  non-element children
 */
type Expected = readonly string[];

/** Branches of a `cond ? a : b` body: the children of each `<>…</>`. */
type Branches = readonly Expected[];

const EXPECTED: ReadonlyArray<{
    file: string;
    shells: readonly Expected[];
    branches?: Branches;
}> = [
    {
        file: "src/components/custom/exams/SimplifiedAcademicsPage.tsx",
        shells: [
            // Previous Semester History
            ["div:div", "div:stack"],
            // My Courses & Marks — three siblings under the shell.
            // A single `div:row` here means a section got trapped in the
            // search/filter row, which is exactly the bug this test exists for.
            ["div:stack", "div:stack", "div:stack"],
        ],
    },
    {
        file: "src/components/custom/exams/CurriculumPage.tsx",
        // The body is one `inSubpage ? subpage : landing` ternary.
        shells: [["ternary"]],
        branches: [["ternary", "cond&&"]],
    },
    {
        file: "src/components/custom/attendance/OverallAttendancePredictor.tsx",
        // Summary grid, lock explainer, milestone strip, calendar card, course
        // menu, info card. The lock explainer is a sibling paragraph, not nested
        // inside the summary grid it explains.
        shells: [["div:div", "p:div", "div:div", "div:stack", "div:stack", "div:stack"]],
        branches: [],
    },
    {
        file: "src/components/custom/attendance/ODTrackerSubpage.tsx",
        shells: [["div:div", "p:div", "div:stack", "cond&&", "TabHelpFooter:control"]],
    },
    {
        file: "src/components/custom/qbank/QBankSubpage.tsx",
        shells: [
            // Course list
            ["ChipTabs:control", "div:div", "cond&&", "SectionHeader:control", "ternary", "expr"],
            // Course detail
            ["SegmentedControl:control", "cond&&", "SubpageScreen:div", "expr"],
        ],
    },
];

const STACK = /(^|\s)space-y-(\d|\[)/;
const ROW = /(^|\s)(sm:)?flex-row(\s|$)/;

/** Strips quotes, braces and whitespace so a value starting with `space-y-` still matches. */
function normaliseClass(raw: string): string {
    return raw.replace(/[`"'{}\s]+/g, " ");
}

function classNameOf(src: ts.SourceFile, open: ts.JsxOpeningElement): string {
    const attr = open.attributes.properties.find(
        (a): a is ts.JsxAttribute =>
            ts.isJsxAttribute(a) && a.name.getText(src) === "className"
    );
    return attr && attr.initializer ? normaliseClass(attr.initializer.getText(src)) : "";
}

function shapeOf(src: ts.SourceFile, child: ts.Node): string {
    if (ts.isJsxElement(child)) {
        const tag = child.openingElement.tagName.getText(src);
        const cls = classNameOf(src, child.openingElement);
        const kind = STACK.test(cls) ? "stack" : ROW.test(cls) ? "row" : "div";
        return `${tag}:${kind}`;
    }
    if (ts.isJsxSelfClosingElement(child)) return `${child.tagName.getText(src)}:control`;
    if (ts.isJsxExpression(child) && child.expression) {
        const e = child.expression;
        if (e.kind === ts.SyntaxKind.BinaryExpression) return "cond&&";
        if (e.kind === ts.SyntaxKind.ConditionalExpression) return "ternary";
        if (ts.isParenthesizedExpression(e)) return "grouped";
        if (ts.isJsxFragment(e)) return "div:div";
        return "expr";
    }
    return "?";
}

/** The direct-children shape of each `PageShell` in source order. */
function pageShellShapes(file: string): string[][] {
    const path = resolve(process.cwd(), file);
    const src = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.ESNext, true);
    const out: string[][] = [];

    const visit = (node: ts.Node): void => {
        if (
            ts.isJsxElement(node) &&
            node.openingElement.tagName.getText(src) === "PageShell"
        ) {
            out.push(
                node.children
                    .filter(
                        (c) =>
                            ts.isJsxElement(c) ||
                            ts.isJsxSelfClosingElement(c) ||
                            (ts.isJsxExpression(c) && c.expression !== undefined)
                    )
                    .map((c) => shapeOf(src, c))
            );
        }
        ts.forEachChild(node, visit);
    };

    visit(src);
    return out;
}

/** The direct children of the `<>…</>` inside a shell's ternary, if there is one. */
function ternaryBranchShapes(file: string): string[][] {
    const path = resolve(process.cwd(), file);
    const src = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.ESNext, true);
    const out: string[][] = [];

    const visit = (node: ts.Node): void => {
        if (
            ts.isJsxElement(node) &&
            node.openingElement.tagName.getText(src) === "PageShell"
        ) {
            for (const child of node.children) {
                if (!ts.isJsxExpression(child) || !child.expression) continue;
                if (!ts.isConditionalExpression(child.expression)) continue;
                const e = child.expression;
                for (const branch of [e.whenTrue, e.whenFalse]) {
                    // `cond ? x : (<>…</>)` — the parser keeps the parens, and the
                    // other branch is legitimately not a fragment (it is the
                    // subpage variable), so only fragments are collected.
                    let node = branch;
                    while (ts.isParenthesizedExpression(node)) node = node.expression;
                    if (!ts.isJsxFragment(node)) continue;
                    out.push(
                        node.children
                            .filter(
                                (c) =>
                                    ts.isJsxElement(c) ||
                                    ts.isJsxSelfClosingElement(c) ||
                                    (ts.isJsxExpression(c) && c.expression !== undefined)
                            )
                            .map((c) => shapeOf(src, c))
                    );
                }
            }
        }
        ts.forEachChild(node, visit);
    };

    visit(src);
    return out;
}

describe("PageShell children are siblings, not nested", () => {
    it.each(EXPECTED)("$file", ({ file, shells }) => {
        const actual = pageShellShapes(file);
        expect(actual.length).toBe(shells.length);
        actual.forEach((children, i) => {
            expect({ shell: i, children }).toEqual({ shell: i, children: shells[i] });
        });
    });

    it.each(EXPECTED)("$file inside its ternary keeps its sections siblings", ({ file, shells, branches }) => {
        // A screen whose body is one ternary still nests its sections inside that
        // fragment, and the unclosed-container bug this file exists for can just
        // as easily happen there. So the fragment's children are asserted too,
        // via `branches`, rather than the check being skipped.
        expect(ternaryBranchShapes(file)).toEqual(branches ?? []);
    });

    it("no converted PageShell collapsed to a single element child", () => {
        // A shell left with one *element* child is the signature of the bug: a
        // container was left unclosed and every later section became its child.
        // Reproducing the original failure collapsed three children into one.
        //
        // A single NON-element child is legitimate — `CurriculumPage`'s whole
        // body is one `inSubpage ? subpage : landing` ternary — so this counts
        // elements only, and EXPECTED is asserted first regardless.
        const ELEMENT = /^(div|p|section|main|ul|ol|nav|form):/;
        for (const { file } of EXPECTED) {
            pageShellShapes(file).forEach((children, i) => {
                const elements = children.filter((c) => ELEMENT.test(c));
                if (elements.length === 1 && children.length === 1) {
                    expect(
                        { file, shell: i, children },
                        `${file} PageShell #${i} has one element child and nothing else — either a genuinely one-section page (add it to EXPECTED) or an unclosed container that swallowed the rest`
                    ).not.toEqual({ file, shell: i, children });
                }
            });
        }
    });
});
