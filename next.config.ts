import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An e2e lane (playwright.local.config.ts) keeps its dev output apart from
  // `pnpm dev` / `pnpm build` so several servers can run in this checkout at once.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
