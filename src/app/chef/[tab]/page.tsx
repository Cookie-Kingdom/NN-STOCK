import { chefNav } from "@/lib/nav";

// Only tabs in the nav exist; anything else is a 404.
export const dynamicParams = false;
export const generateStaticParams = () =>
  chefNav.flatMap((group) => group.items.map((item) => ({ tab: item.id })));

// ponytail: renders nothing, the layout's workspace reads the tab from the URL.
export default function ChefTab() {
  return null;
}
