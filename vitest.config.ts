import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts: unit tests exercise plain TypeScript modules
// and don't need the React Router or Tailwind plugins.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["app/**/*.test.ts", "server/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
