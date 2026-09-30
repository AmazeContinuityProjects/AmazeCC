import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The zinc scale is bound to the semantic tokens, and that binding is what makes
 * the accent colour picker work.
 *
 * Every surface in the app is written in zinc (`bg-white/80 dark:bg-zinc-900/70`,
 * `text-zinc-900 dark:text-white`, `border-zinc-200/70`). Stock Tailwind zinc is a
 * fixed palette, so those classes ignore the palette picker entirely: switching
 * palette recoloured the semantic layer and left the zinc layer grey.
 *
 * `globals.css` maps each zinc step onto a semantic variable inside an
 * `@theme inline` block. This test guards that mapping, because losing it does
 * not break the build, does not fail a typecheck, and does not fail any other
 * test — it just quietly desynchronises the whole app from the palette picker.
 */

const globalsCss = readFileSync(
    resolve(process.cwd(), "src/app/globals.css"),
    "utf8"
);

/**
 * Each zinc step aliases the same-numbered `--neutral-*` step.
 *
 * The indirection is load-bearing and must not be collapsed into direct
 * semantic references. Each zinc step plays two roles, one per mode, because the
 * app writes `light-step dark:other-step` on the same class family:
 *
 *     text-zinc-900 dark:text-white    light: near-black ink
 *     dark:bg-zinc-900/70              dark:  dark card surface
 *
 * `--neutral-900` is `--text-heading` in light (oklch 0.18) and `--surface` in
 * dark (oklch 0.20) — near-black in both, so one value satisfies both roles.
 * Binding zinc-900 straight to `--text-heading` instead yields oklch 0.985
 * (near-white) in dark mode, which is how a previous revision painted all 238
 * `dark:bg-zinc-900` cards white-on-black.
 */
const ZINC_BINDINGS: ReadonlyArray<readonly [string, string]> = [
    ["50", "--neutral-50"],
    ["100", "--neutral-100"],
    ["200", "--neutral-200"],
    ["300", "--neutral-300"],
    ["400", "--neutral-400"],
    ["500", "--neutral-500"],
    ["600", "--neutral-600"],
    ["700", "--neutral-700"],
    ["800", "--neutral-800"],
    ["900", "--neutral-900"],
    ["950", "--neutral-950"],
];

/**
 * Steps that were never stock Tailwind, so no theme emitted a rule for them and
 * they rendered as nothing — a silent hole, not a near-miss colour. 219
 * occurrences across 40 files.
 *
 * Phase 0 normalised all of them at the source, so the source no longer
 * references any of these. The aliases are kept in `globals.css` deliberately:
 * they are the reason the normalisation could be done as a pure rename with no
 * visual change, and they remain the contract for anyone who reintroduces one.
 * `globals.css` owns them; this list is the guard that keeps the two in sync.
 */
const OFF_SCALE_BINDINGS: ReadonlyArray<readonly [string, string]> = [
    ["55", "--neutral-50"],
    ["150", "--neutral-100"],
    ["250", "--neutral-200"],
    ["350", "--neutral-300"],
    ["405", "--neutral-400"],
    ["450", "--neutral-400"],
    ["455", "--neutral-400"],
    ["550", "--neutral-500"],
    ["555", "--neutral-500"],
    ["650", "--neutral-600"],
    ["655", "--neutral-600"],
    ["750", "--neutral-700"],
    ["850", "--neutral-800"],
];

function themeBlocks(css: string): string[] {
    return [...css.matchAll(/@theme\s+(?:inline\s+)?\{([^}]*)\}/g)].map((m) => m[1] ?? "");
}

const blocks = themeBlocks(globalsCss);

function declarationFor(step: string): string | undefined {
    for (const block of blocks) {
        const match = block.match(new RegExp(`--color-zinc-${step}\\s*:\\s*([^;]+);`));
        if (match) return match[1]?.trim();
    }
    return undefined;
}

const SRC = resolve(process.cwd(), "src");
const CODE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "__tests__"]);

/**
 * Every distinct `zinc-NN` referenced by a source file.
 *
 * Memoised deliberately. This is a whole-tree scan, it was previously called
 * once per test case, and the aggregate cost across the suite made the file slow
 * enough to dominate a run. Caching also removes the flake where two cases read
 * the tree at slightly different moments and disagree about a file that some
 * other worker was mid-write on.
 */
let sourceStepCache: readonly string[] | undefined;

function collectZincStepsFromSource(): readonly string[] {
    if (sourceStepCache) return sourceStepCache;

    const found = new Set<string>();

    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            if (SKIP_DIRS.has(entry)) continue;
            const full = join(dir, entry);
            let isDir = false;
            try {
                isDir = statSync(full).isDirectory();
            } catch {
                // A file removed between readdir and stat (another test worker
                // cleaning up). It cannot have contributed a zinc step.
                continue;
            }
            if (isDir) {
                walk(full);
                continue;
            }
            if (!CODE_EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) continue;

            let source: string;
            try {
                source = readFileSync(full, "utf8");
            } catch {
                continue;
            }
            for (const match of source.matchAll(/zinc-(\d+)/g)) {
                const step = match[1];
                if (step) found.add(`zinc-${step}`);
            }
        }
    };

    walk(SRC);
    sourceStepCache = [...found].sort();
    return sourceStepCache;
}

describe("zinc is bound to the semantic tokens", () => {
    it("declares every stock zinc step", () => {
        const missing = ZINC_BINDINGS.map(([step]) => step).filter(
            (step) => declarationFor(step) === undefined
        );
        expect(missing).toEqual([]);
    });

    it.each(ZINC_BINDINGS)(
        "zinc-%s resolves to var(%s)",
        (step, variable) => {
            expect(declarationFor(step)).toBe(`var(${variable})`);
        }
    );

    it.each([...ZINC_BINDINGS, ...OFF_SCALE_BINDINGS])(
        "zinc-%s goes through --neutral-*, not a direct semantic reference",
        (step) => {
            // The regression this guards: a direct `var(--text-heading)` looks
            // correct in light mode and is near-white in dark mode, so it is
            // invisible to any light-mode check.
            expect(declarationFor(step)).toMatch(/^var\(--neutral-\d+\)$/);
        }
    );

    it("binds the binding in an @theme inline block so the .dark overrides apply", () => {
        // Without `inline`, Tailwind emits the zinc value into a generated
        // variable that is resolved once, at :root — which would capture the
        // light-mode value and ignore both the .dark block and the per-palette
        // overrides Main.tsx writes onto documentElement.
        const inlined = blocks.filter((b) => /--color-zinc-\d/.test(b));
        expect(inlined.length).toBeGreaterThan(0);

        const rawTheme = globalsCss.match(/@theme\s+(?!inline)\{([^}]*--color-zinc)/);
        expect(rawTheme).toBeNull();
    });
});

describe("off-scale zinc steps", () => {
    it.each(OFF_SCALE_BINDINGS)(
        "zinc-%s is defined and bound to var(%s)",
        (step, variable) => {
            expect(declarationFor(step)).toBe(`var(${variable})`);
        }
    );

    it("covers every off-scale step that appears in the source", () => {
        // Scans the source for zinc-* steps and asserts each one is either a
        // stock step or explicitly aliased. A new undeclared step (zinc-425, say)
        // renders as nothing, and nothing else in the suite would notice.
        const sourceSteps = collectZincStepsFromSource();

        const declared = new Set(
            [...ZINC_BINDINGS, ...OFF_SCALE_BINDINGS].map(([step]) => `zinc-${step}`)
        );
        const undeclared = sourceSteps.filter((s) => !declared.has(s));

        expect(undeclared).toEqual([]);
    });

    it("is no longer referenced by the source (Phase 0 normalised it)", () => {
        // The aliases are a safety net, not the target state. Once the source
        // stops asking for them they should be deletable; this case fails first
        // so the deletion is a deliberate act rather than an accident.
        const inUse = OFF_SCALE_BINDINGS.filter(([step]) =>
            collectZincStepsFromSource().includes(`zinc-${step}`)
        );

        expect(inUse).toEqual([]);
    });
});
