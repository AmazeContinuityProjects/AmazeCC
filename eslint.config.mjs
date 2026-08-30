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
];

export default eslintConfig;