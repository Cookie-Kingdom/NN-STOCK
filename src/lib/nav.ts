import {
  ClipboardList,
  Factory,
  LayoutDashboard,
  Package,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Account } from "./accounts";

export type Tab =
  "overview" | "log" | "lots" | "stock" | "finance" | "settings";

/** Every page: its name (English, V2-ACC-09), the line under it and its icon. */
export const pages: Record<
  Tab,
  { label: string; description: string; icon: LucideIcon }
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
  },
  lots: {
    label: "Lots",
    description: "PO เนื้อ และ Lot รมควัน",
    icon: Factory,
  },
  stock: {
    label: "Stock",
    description: "เนื้อ วัสดุ และน้ำพริกคงเหลือ",
    icon: Package,
  },
  finance: {
    label: "Finance",
    description: "จ่ายเงิน และยอดคงเหลือต่อผู้ขาย",
    icon: Wallet,
  },
  settings: {
    label: "Settings",
    description: "ค่าที่เว็บใช้คิด และข้อมูลหัวเอกสาร",
    icon: Settings,
  },
};

/** The pages an account has, in menu order: the Owner all six, the Account Manager four
 *  (no Overview, no Settings), a branch two. */
export const navFor = (account: Pick<Account, "role" | "hidesSales">): Tab[] =>
  account.role === "branch"
    ? ["log", "stock"]
    : account.hidesSales
      ? ["log", "lots", "stock", "finance"]
      : ["overview", "log", "lots", "stock", "finance", "settings"];
