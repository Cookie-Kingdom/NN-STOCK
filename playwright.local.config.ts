import { defineConfig } from "@playwright/test";
import { rmSync } from "node:fs";
import base from "./playwright.config";

// The same suite against the local SQLite backend (src/app/api/local-db) instead of
// Supabase: its own dev server on :3100 and a fresh database file per run.
process.env.NEXT_PUBLIC_LOCAL_DB = "1";
process.env.LOCAL_DB_FILE = "artifacts/e2e-local.db";
// Workers re-evaluate this file; only the runner may wipe the database.
if (!process.env.TEST_WORKER_INDEX) rmSync(process.env.LOCAL_DB_FILE, { force: true });

export default defineConfig({
  ...base,
  // Every spec writes the one app_state row; parallel workers hit revision
  // conflicts, the app reloads, and the step just saved disappears.
  workers: 1,
  use: { ...base.use, baseURL: "http://localhost:3100" },
  webServer: {
    command: "pnpm.cmd dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_LOCAL_DB: "1", LOCAL_DB_FILE: process.env.LOCAL_DB_FILE },
  },
});
