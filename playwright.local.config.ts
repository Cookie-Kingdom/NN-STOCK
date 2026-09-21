import { defineConfig } from "@playwright/test";
import { rmSync } from "node:fs";
import base from "./playwright.config";

// The same suite against the local SQLite backend (src/app/api/local-db) instead of
// Supabase: its own dev server on :3100 and a fresh database file per run.
// E2E_PORT=3101 runs a second, independent lane (own port, database, Next dist dir
// and artifacts) so two spec files can run side by side without sharing state.
const port = process.env.E2E_PORT ?? "3100";
const lane = port === "3100" ? "" : `-${port}`;
process.env.NEXT_PUBLIC_LOCAL_DB = "1";
process.env.LOCAL_DB_FILE = `artifacts/e2e-local${lane}.db`;
// Workers re-evaluate this file; only the runner may wipe the database.
if (!process.env.TEST_WORKER_INDEX)
  rmSync(process.env.LOCAL_DB_FILE, { force: true });
// Every run keeps its own results folder so reruns never overwrite earlier evidence
// (videos, failure screenshots, HTML report, results.json). The runner stamps
// E2E_RUN once; workers inherit it, so they resolve the same folder.
process.env.E2E_RUN ??= new Date()
  .toISOString()
  .slice(0, 19)
  .replace(/[T:]/g, "-");
const runDir = `artifacts/e2e-runs/${process.env.E2E_RUN}-${port}`;

export default defineConfig({
  ...base,
  // Every spec writes the one app_state row; parallel workers hit revision
  // conflicts, the app reloads, and the step just saved disappears.
  workers: 1,
  outputDir: `${runDir}/output`,
  reporter: [
    ["list"],
    ["html", { outputFolder: `${runDir}/report`, open: "never" }],
    // Read by scripts/e2e-flow-report.mjs to render one flow page per spec.
    ["json", { outputFile: `${runDir}/results.json` }],
  ],
  use: { ...base.use, baseURL: `http://localhost:${port}` },
  webServer: {
    command: `pnpm.cmd dev -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_LOCAL_DB: "1",
      LOCAL_DB_FILE: process.env.LOCAL_DB_FILE,
      NEXT_DIST_DIR: `.next/e2e${lane}`,
    },
  },
});
