import {
  Archive,
  Beef,
  BookText,
  ChartColumn,
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
  | "projectOverview"
  | "log"
  | "lots"
  | "meatStock"
  | "stock"
  | "finance"
  | "oldLots"
  | "accounting"
  | "settings";

/** The sidebar section that holds the project's Overview, Daily Log, Lots, Stock, Inventory,
 *  Finance and Old Lots. */
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
    description: "Revenue ของร้าน รวมทุกโปรเจกต์",
    icon: LayoutDashboard,
  },
  // The same name as the shop's, under the project's heading: /owner/nn-x-lm/overview. A
  // phone's bar holds the shop's only; this one is in its menu, under the heading.
  projectOverview: {
    label: "Overview",
    description: `Revenue ของ ${shopProject}`,
    icon: ChartColumn,
    group: shopGroup,
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
  // The key `stock` is the Inventory page below.
  meatStock: {
    label: "Stock",
    description: "เนื้อ ข้าวเหนียว และน้ำพริกคงเหลือ",
    icon: Beef,
    group: shopGroup,
  },
  stock: {
    label: "Inventory",
    description: "สินทรัพย์ของโปรเจกต์ และวัสดุคงเหลือของแต่ละสาขา",
    icon: Package,
    group: shopGroup,
  },
  finance: {
    label: "Finance",
    description: "เงินที่จ่ายจริง ยอดค้างจ่ายผู้ขาย และเงินที่ต้องคืนพนักงาน",
    icon: Wallet,
    group: shopGroup,
  },
  // Lots, for the POs flagged `old` (model.ts).
  oldLots: {
    label: "Old Lots",
    description: "PO จากไฟล์เดิมที่จดไม่ครบ",
    icon: Archive,
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
    description: "ค่าที่ใช้คำนวณ และข้อมูลหัวเอกสาร",
    icon: Settings,
  },
};

/** The line under a page's name. A branch's Stock and Inventory hold its own branch only. */
export const descriptionFor = (account: Pick<Account, "role">, tab: Tab) =>
  account.role !== "branch"
    ? pages[tab].description
    : tab === "meatStock"
      ? "เนื้อ ข้าวเหนียว และน้ำพริกคงเหลือของสาขา"
      : tab === "stock"
        ? "วัสดุและสินทรัพย์อื่นของสาขา"
        : pages[tab].description;

/** The pages an account has, in menu order: the Owner all ten, the Account Manager seven
 *  (no Overview of the shop or of the project, no Settings), a branch three. */
export const navFor = (account: Pick<Account, "role" | "hidesSales">): Tab[] =>
  account.role === "branch"
    ? ["log", "meatStock", "stock"]
    : account.hidesSales
      ? [
          "log",
          "lots",
          "meatStock",
          "stock",
          "finance",
          "oldLots",
          "accounting",
        ]
      : [
          "overview",
          "projectOverview",
          "log",
          "lots",
          "meatStock",
          "stock",
          "finance",
          "oldLots",
          "accounting",
          "settings",
        ];

/** The pages in a phone's bottom bar. An account with five pages or fewer: all of them, as
 *  tabs. With more: these four, beside a fifth button, "เมนู", that lists every page. */
export const barFor = (
  account: Pick<Account, "role" | "hidesSales">,
): Tab[] => {
  const all = navFor(account);
  return all.length <= 5
    ? all
    : account.hidesSales
      ? ["log", "lots", "finance", "accounting"]
      : ["overview", "log", "lots", "finance"];
};

/** A page's address under an account's route: the menu name in lowercase with dashes, behind
 *  the section's slug when the page sits in it (`/owner/nn-x-lm/daily-log`, `/owner/settings`). */
export const pagePath = (account: Pick<Account, "path">, tab: Tab) =>
  `${account.path}${pages[tab].group ? `/${shopGroupSlug}` : ""}/${pages[tab].label.toLowerCase().replaceAll(" ", "-")}`;

/** The page of the account at `pathname`, if it is one of its pages. */
export const tabAt = (
  account: Pick<Account, "path" | "role" | "hidesSales">,
  pathname: string,
) => navFor(account).find((tab) => pagePath(account, tab) === pathname);
