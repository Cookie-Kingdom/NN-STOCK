import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Beef,
  ClipboardList,
  Factory,
  FilePlus2,
  History,
  LayoutDashboard,
  ListChecks,
  Package,
  Settings,
  Store,
  Warehouse,
} from "lucide-react";

export type Tab =
  | "owner-dashboard"
  | "work"
  | "cm-receive"
  | "po"
  | "smoke-po"
  | "invoices"
  | "documents"
  | "foodiva"
  | "transport"
  | "return-shipment"
  | "central-receive"
  | "branch-status"
  | "branch-summary"
  | "stock"
  | "meat-log"
  | "day"
  | "report"
  | "history"
  | "config";

export type Modal = { kind: string; lotId: string };

export type NavItem = { id: Tab; label: string; icon: typeof Package };
export type NavGroup = { label?: string; items: NavItem[] };

/* One nav per account. An account only lists what its own workspace renders —
 * a menu entry with no screen behind it is not expressible here. */

export const ownerNav: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [
      { id: "owner-dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
    ],
  },
  {
    label: "จัดซื้อและใบสั่ง",
    items: [
      { id: "po", label: "ใบสั่งซื้อ PO", icon: FilePlus2 },
      { id: "smoke-po", label: "ใบสั่ง PO โรงรมควัน", icon: Factory },
      { id: "invoices", label: "ใบ Invoice", icon: ClipboardList },
    ],
  },
  {
    label: "ขนส่งและรับเข้า",
    items: [
      { id: "transport", label: "Request ใบขนส่งขาไป", icon: ArrowRight },
      {
        id: "return-shipment",
        label: "สร้างใบขนส่งขากลับ",
        icon: ArrowLeft,
      },
      {
        id: "central-receive",
        label: "รับเนื้อเข้าสต๊อกกลาง",
        icon: Warehouse,
      },
    ],
  },
  {
    label: "สต๊อกและสาขา",
    items: [
      {
        id: "branch-status",
        label: "จัดสรรเนื้อ และสต๊อกไปสาขา",
        icon: ListChecks,
      },
      { id: "stock", label: "สต๊อกของทั้งหมด", icon: Package },
      { id: "meat-log", label: "Log เนื้อคงเหลือ", icon: Beef },
    ],
  },
  {
    label: "เอกสารและรายงาน",
    items: [
      { id: "documents", label: "เอกสารและ Traceability", icon: ClipboardList },
      { id: "report", label: "รายงาน", icon: BarChart3 },
      { id: "history", label: "Log", icon: History },
    ],
  },
  {
    label: "ระบบ",
    items: [{ id: "config", label: "ตั้งค่า", icon: Settings }],
  },
];

/** Account Manager: the Owner's workspace without the dashboard (it shows sales money). */
export const managerNav: NavGroup[] = ownerNav.filter(
  (group) => !group.items.some((item) => item.id === "owner-dashboard"),
);

export const foodivaNav: NavGroup[] = [
  {
    items: [
      { id: "foodiva", label: "PO และสต๊อก Foodiva", icon: Beef },
      { id: "history", label: "ประวัติ", icon: History },
    ],
  },
];

export const chefNav: NavGroup[] = [
  {
    items: [
      { id: "cm-receive", label: "ยืนยันรับเนื้อ", icon: Warehouse },
      { id: "work", label: "งานผลิต", icon: ClipboardList },
      { id: "stock", label: "สต๊อก", icon: Package },
      { id: "history", label: "ประวัติ", icon: History },
    ],
  },
];

export const branchNav: NavGroup[] = [
  {
    items: [
      { id: "day", label: "กรอกรายวัน", icon: Store },
      { id: "stock", label: "สต๊อก", icon: Package },
      { id: "branch-summary", label: "สรุปสาขา", icon: LayoutDashboard },
      { id: "history", label: "ประวัติ", icon: History },
    ],
  },
];

export function navLabel(groups: NavGroup[], tab: Tab): string {
  for (const group of groups) {
    const hit = group.items.find((item) => item.id === tab);
    if (hit) return hit.label;
  }
  return "";
}
