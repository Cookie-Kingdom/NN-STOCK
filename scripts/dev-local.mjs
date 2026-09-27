// `pnpm dev:local [-p 3200]`: `next dev` against the local SQLite backend
// (NEXT_PUBLIC_LOCAL_DB=1, file .local/app.db) on any OS, without cross-env.
// Load the UAT data with: curl -X PUT "http://localhost:3000/api/local-db?state=uat"
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
spawn(process.execPath, [next, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_LOCAL_DB: "1" },
}).on("exit", (code) => process.exit(code ?? 0));
