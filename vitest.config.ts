import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` -> `./src/*` mapping in tsconfig.json and the app's
    // own resolution. Without this, any module that imports through the alias
    // simply cannot be tested - the import fails to resolve at collection time.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Styles are irrelevant to these tests, and the project PostCSS config
  // (tailwind + a plugin Vite loads differently) fails hard on a third-party
  // stylesheet. Nothing under test asserts on computed style.
  css: { postcss: { plugins: [] } },
  // The heaviest render tests (FFCS tab, planner pages) were given per-test
  // 30s budgets; the 5s default starves them under a full parallel run and
  // flaky-fails tests that pass in isolation. Give every test the same
  // headroom the heavy ones already pin, rather than whack-a-mole per case.
  //
  // Worker count: the default (cpus-1 = 7) keeps a whole jsdom + the FFCS
  // module graph per worker; this suite then flips a handful of heavy tests
  // between green and timeout depending on what else the machine is doing.
  // Half the cores is still plenty parallel and stops them starving each
  // other. Raise if the suite has room to breathe.
  test: {
    testTimeout: 30_000,
    maxWorkers: 4,
    environment: "jsdom",
    globals: true,
    server: {
      deps: {
        // Anything that renders a component must import the `@amazeui` barrel
        // for `cn`, and that barrel transitively imports
        // `react-circular-progressbar/dist/styles.css`. Vite externalises
        // node_modules by default, so Node's ESM loader gets the `.css`
        // request and rejects it with "Unknown file extension". Inlining hands
        // the package back to Vite, which stubs the stylesheet.
        //
        // This only matters for tests that render DOM; the other 19 test files
        // import no component and never reach the barrel.
        inline: ["@amazecontinuityprojects/amazeui", "react-circular-progressbar"],
      },
    },
  },
});
