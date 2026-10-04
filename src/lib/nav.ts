import {
  Beef,
  BookText,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Package,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Account } from "./accounts";
import { shopProject } from "./store/ledger";

export type Tab =
  | "overview"
  | "log"
  | "lots"
  | "meatStock"
  | "stock"
  | "finance"
  | "accounting"
  | "settings";

/** The sidebar section that holds Daily Log, Lots, Stock, Inventory and Finance. */
export const shopGroup = shopProject;

/** The section's part of a page's address: /owner/nn-x-lm/daily-log. */
export const shopGroupSlug = "nn-x-lm";

/** Every page: its name (English, V2-ACC-09), the line under it, its icon and, for a page
 *  that sits in a sidebar section, that section's heading. */
export const pages: Record<
  Tab,
  { label: string; description: string; icon: LucideIcon; group?: string }
> = {
  overview: {
    label: "Overview",
    description: "สรุปของเดือน และสิ่งที่ยังไม่ได้จด",
    icon: LayoutDashboard,
  },
  log: {
    label: "Daily Log",
    description: "บันทึกทั้งหมด เรียงตามวัน",
    icon: ClipboardList,
    group: shopGroup,
  },
  lots: {
    label: "Lots",
    description: "PO เนื้อ และ PO รมควัน",
    icon: Factory,
    group: shopGroup,
  },
  // The Owner's and the Manager's only. The key `stock` is the Inventory page below.
  meatStock: {
    label: "Stock",
    description: "เนื้อ ข้าวเหนียว และน้ำพริกคงเหลือ",
    icon: Beef,
    group: shopGroup,
  },
  stock: {
    label: "Inventory",
    description: "เนื้อ วัสดุ และน้ำพริกคงเหลือ",
    icon: Package,
    group: shopGroup,
  },
  finance: {
    label: "Finance",
    description: "จ่ายเงิน และยอดคงเหลือต่อผู้ขาย",
    icon: Wallet,
    group: shopGroup,
  },
  // Shop-wide, outside the section: every purchase, of the project or not.
  accounting: {
    label: "Accounting",
    description: "รายการซื้อทั้งหมดของร้าน",
    icon: BookText,
  },
  settings: {
    label: "Settings",
    description: "ค่าที่เว็บใช้คิด และข้อมูลหัวเอกสาร",
    icon: Settings,
  },
};

/** The pages an account has, in menu order: the Owner all eight, the Account Manager six
 *  (no Overview, no Settings), a branch two. */
export const navFor = (account: Pick<Account, "role" | "hidesSales">): Tab[] =>
  account.role === "branch"
    ? ["log", "stock"]
    : account.hidesSales
      ? ["log", "lots", "meatStock", "stock", "finance", "accounting"]
      : [
          "overview",
          "log",
          "lots",
          "meatStock",
          "stock",
          "finance",
          "accounting",
          "settings",
        ];

/** A page's address under an account's route: the menu name in lowercase with dashes, behind
 *  the section's slug when the page sits in it (`/owner/nn-x-lm/daily-log`, `/owner/settings`). */
export const pagePath = (account: Pick<Account, "path">, tab: Tab) =>
  `${account.path}${pages[tab].group ? `/${shopGroupSlug}` : ""}/${pages[tab].label.toLowerCase().replaceAll(" ", "-")}`;

/** The page of the account at `pathname`, if it is one of its pages. */
export const tabAt = (
  account: Pick<Account, "path" | "role" | "hidesSales">,
  pathname: string,
) => navFor(account).find((tab) => pagePath(account, tab) === pathname);
