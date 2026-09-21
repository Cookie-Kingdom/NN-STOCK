import { defineConfig, devices } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";

// Load .env.local (E2E_* credentials) once for the runner and its workers.
// Playwright does not read it; @next/env is only reachable through next under
// pnpm's strict layout.
const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
createRequire(requireFromRoot.resolve("next/package.json"))(
  "@next/env",
).loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

// Scratch specs (`_*.spec.ts`, e.g. the visual baseline) run only when asked:
// VISUAL=1, or SHOT_DIR set as in the documented visual command.
const includeScratch = Boolean(process.env.VISUAL || process.env.SHOT_DIR);

export default defineConfig({
  testDir: "./tests/e2e",
  ...(includeScratch ? {} : { testIgnore: "**/_*.spec.ts" }),
  timeout: 600_000,
  expect: { timeout: 10_000 },
  outputDir: "artifacts/playwright",
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }],
  ],
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
