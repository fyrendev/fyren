import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E tests.
 * Uses a separate test database (fyren_test) to avoid conflicts with development.
 *
 * Before running tests:
 * 1. Ensure docker compose is running (creates both fyren and fyren_test databases)
 * 2. Run migrations on test db: DATABASE_URL=postgres://fyren:fyren@localhost:5432/fyren_test bun run db:push
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Run tests serially to avoid state conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Use single worker for database consistency
  reporter: "html",
  timeout: 60000, // Increase timeout to 60s
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    actionTimeout: 15000, // 15s for actions
  },

  projects: [
    // Setup project runs first to seed test data
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  // Web server configuration - start both API and web
  // API uses test database via .env.test
  webServer: [
    {
      command: "cd ../api && bun run dev:test",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "bun run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
