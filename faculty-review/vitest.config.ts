import { defineConfig } from "vitest/config";

// Explicit config so the Worker never inherits the parent app's jsdom config.
// Workers APIs used here (fetch, Request, Response, crypto.subtle) exist in Node.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
