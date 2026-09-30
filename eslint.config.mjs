import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/config": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/refs": "off",
      "react-hooks/gating": "off",
      "react-hooks/rules-of-hooks": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-img-element": "warn",
      // Guardrail for the unified SyncEngine: NO component may import the raw
      // network primitive (fetchWithTimeout / API_BASE) — every app-API call
      // must go through `api` from src/lib/sync-engine. Non-network helpers in
      // fetch-utils (getActiveApiUrl, getRewrittenUrl, …) are still allowed;
      // the engine's own request-layer is the only place that may use the
      // network primitive (allowed via the override below).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/fetch-utils",
              importNames: ["fetchWithTimeout", "API_BASE"],
              message:
                "Network calls must go through the SyncEngine (src/lib/sync-engine). Use `api` instead of fetchWithTimeout/API_BASE.",
            },
          ],
        },
      ],
    },
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["src/lib/sync-engine/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  // Design-token guardrails.
  //
  // Each of these encodes a decision from docs/sep-29-2026/ui-upgrade-final/ and
  // design/DESIGN_LANGUAGE.md. All are `warn` because the codebase is mid
  // migration; they are scheduled to become `error` as each phase lands.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/components/custom/shared/primitives/**",
      "src/lib/uiTokens.ts",
    ],
    rules: {
      // R9. `rounded-3xl` is Tailwind's 24px, which our scale spells
      // `rounded-[24px]`. Identical rendering, but two spellings of one surface
      // hide drift when only one of them gets edited. See DESIGN_LANGUAGE.md §5.
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "Literal[value=/\\brounded-3xl\\b/]",
          message:
            "Use rounded-[24px] (the 24px step). `rounded-3xl` is the same size but a second spelling of it — see design/DESIGN_LANGUAGE.md §5.",
        },
      ],
    },
  },
  {
    // The primitives and the token module are the definition of the dialect, so
    // they are exempt from the token rules that everything else must follow.
    files: [
      "src/components/custom/shared/primitives/**",
      "src/lib/uiTokens.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];

export default eslintConfig;