import {
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
  "overview" | "log" | "lots" | "stock" | "finance" | "accounting" | "settings";

/** The sidebar section that holds Daily Log, Lots, Inventory and Finance. */
export const shopGroup = shopProject;

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

/** The pages an account has, in menu order: the Owner all seven, the Account Manager five
 *  (no Overview, no Settings), a branch two. */
export const navFor = (account: Pick<Account, "role" | "hidesSales">): Tab[] =>
  account.role === "branch"
    ? ["log", "stock"]
    : account.hidesSales
      ? ["log", "lots", "stock", "finance", "accounting"]
      : [
          "overview",
          "log",
          "lots",
          "stock",
          "finance",
          "accounting",
          "settings",
        ];
