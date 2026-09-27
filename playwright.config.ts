import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const isCI = !!process.env.CI;

/**
 * End-to-end tests run the production build against the fixture vault, never a real one.
 * Environment variables set here override anything in a local .env.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && node server.js",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      VAULT_PATH: "./tests/fixtures/vault",
      // Inside the output folder, which Playwright empties before starting the server each run.
      DATA_PATH: "./test-results/e2e-data",
      ROLL20_CAMPAIGN_URL: "https://app.roll20.net/campaigns/details/0000000/fixture",
      // Pretend accounts instead of Discord; only possible because the server is on this machine.
      DEV_LOGIN: "true",
      SESSION_SECRET: "e2e-only-session-secret-not-for-real-use",
    },
  },
});
