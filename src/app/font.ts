import localFont from "next/font/local";

/** The app's font, from a file in the repo (the upstream variable font of
 *  google/fonts ofl/notosansthailooped, normal width, weights 400–600; its licence is beside
 *  it). Not `next/font/google`: that fetches at build time, and a build fails whenever Google
 *  answers with an extensionless `/l/font?kit=` address (vercel/next.js#99114). */
export const notoSansThaiLooped = localFont({
  src: "./fonts/NotoSansThaiLooped.woff2",
  variable: "--font-noto-sans-thai-looped",
  weight: "400 600",
  display: "swap",
});
