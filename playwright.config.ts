import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 600_000,
  expect: { timeout: 10_000 },
  outputDir: "artifacts/playwright",
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 10_000,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    video: { mode: "on", size: { width: 1440, height: 900 } },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm.cmd dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
