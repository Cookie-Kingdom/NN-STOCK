import type { NextConfig } from "next";

// CSP without nonces (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// - script-src 'unsafe-inline': Next's hydration scripts and the theme init script in
//   app/layout.tsx are inline; nonces would force every page dynamic. Dev also needs eval.
// - connect-src: the Supabase project (REST, auth, storage) and its realtime websocket,
//   taken from the env so a local or branch project works too.
// - img/object/frame blob: + data: attachments are previewed as Blob URLs (and inherit this CSP).
// - fonts.googleapis/gstatic: the DocumentPrintButton popup loads Noto Sans Thai.
const supabase = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.co",
);
const supabaseWs = `${supabase.protocol === "http:" ? "ws" : "wss"}://${supabase.host}`;
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' blob: data:",
  `connect-src 'self' ${supabase.origin} ${supabaseWs}`,
  "object-src 'self' blob:",
  "frame-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // An e2e lane (playwright.local.config.ts) keeps its dev output apart from
  // `pnpm dev` / `pnpm build` so several servers can run in this checkout at once.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
