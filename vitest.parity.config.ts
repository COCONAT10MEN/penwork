import { defineConfig } from "vitest/config";

// Separate from `npm test`, because it opens a real browser: run it with `npm run test:parity`.
export default defineConfig({
  test: {
    include: ["tests/parity/**/*.test.ts"],
    server: { deps: { inline: ["@material/material-color-utilities"] } },
  },
});
