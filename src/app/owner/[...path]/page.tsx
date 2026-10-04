import { notFound, redirect } from "next/navigation";
import { navFor, pagePath, tabAt } from "@/lib/nav";

const account = { path: "/owner", role: "owner" } as const;

/* Only the pages in the nav exist; anything else is a 404. No build-time list in `next dev`
 * on purpose (each page is rendered on its first visit and then served static): with one,
 * `next dev` rewrites .next/prerender-manifest.json as it first resolves each page, and the
 * sidebar's concurrent prefetches read it half-written ("Unexpected end of JSON input"). */
export const generateStaticParams = () =>
  process.env.NODE_ENV === "production"
    ? navFor(account).map((tab) => ({
        path: pagePath(account, tab).split("/").slice(2),
      }))
    : [];

// ponytail: renders nothing, the layout's workspace reads the page from the URL.
export default async function OwnerPage({
  params,
}: PageProps<"/owner/[...path]">) {
  const path = (await params).path.join("/");
  if (tabAt(account, `/owner/${path}`)) return null;
  // An address from before the pages were named after the menu (/owner/log).
  const old = navFor(account).find((tab) => tab === path);
  if (old) redirect(pagePath(account, old));
  notFound();
}
