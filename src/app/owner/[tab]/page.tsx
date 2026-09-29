import { notFound } from "next/navigation";
import { ownerNav } from "@/lib/nav";

/* Only tabs in the nav exist; anything else is a 404. Each tab is rendered on its first
 * visit and then served static. No build-time list on purpose: with one, `next dev`
 * rewrites .next/prerender-manifest.json as it first resolves each tab, and the sidebar's
 * concurrent prefetches read it half-written ("Unexpected end of JSON input"). */
export const generateStaticParams = () => [];

// ponytail: renders nothing, the layout's workspace reads the tab from the URL.
export default async function OwnerTab({ params }: PageProps<"/owner/[tab]">) {
  const { tab } = await params;
  if (!ownerNav.some((group) => group.items.some((item) => item.id === tab)))
    notFound();
  return null;
}
