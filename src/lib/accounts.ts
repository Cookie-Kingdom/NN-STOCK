import { Beef, Building2, Factory, Store } from "lucide-react";
import type { Role } from "@/lib/store";
import type { Tab } from "@/lib/nav";

export type AccountId = "owner" | "fooddiva" | "chef" | "saladaeng" | "minburi";

export type Account = {
  id: AccountId;
  role: Role;
  /** Set only for branch accounts — the branch whose data this account may touch. */
  branch?: string;
  name: string;
  title: string;
  summary: string;
  path: string;
  homeTab: Tab;
  icon: typeof Beef;
};

export const accounts: Account[] = [
  {
    id: "owner",
    role: "owner",
    name: "Owner",
    title: "เจ้าของร้าน",
    summary: "จัดซื้อ จัดสรร ตั้งค่า และติดตามรายงานของทุกสาขา",
    path: "/owner",
    homeTab: "owner-dashboard",
    icon: Building2,
  },
  {
    id: "fooddiva",
    role: "fooddiva",
    name: "Food Diva",
    title: "ผู้ขายเนื้อ · ออก Invoice",
    summary: "รับ PO ออก Invoice เก็บเนื้อรอรถ และยืนยันรับเนื้อรมควันกลับเข้าสต๊อก",
    path: "/fooddiva",
    homeTab: "food-diva",
    icon: Beef,
  },
  {
    id: "chef",
    role: "cm",
    name: "Chef_house",
    title: "ฝ่ายผลิต · เชียงใหม่",
    summary: "รับเนื้อ ผลิต และส่งมอบสต๊อกกลับส่วนกลาง",
    path: "/chef",
    homeTab: "cm-receive",
    icon: Factory,
  },
  {
    id: "saladaeng",
    role: "branch",
    branch: "ศาลาแดง",
    name: "สาขาศาลาแดง",
    title: "ผู้ดูแลสาขา",
    summary: "รับของ บันทึกการใช้ ขาย และปิดยอดประจำวัน",
    path: "/branch",
    homeTab: "day",
    icon: Store,
  },
  {
    id: "minburi",
    role: "branch",
    branch: "มีนบุรี",
    name: "สาขามีนบุรี",
    title: "ผู้ดูแลสาขา",
    summary: "รับของ บันทึกการใช้ ขาย และปิดยอดประจำวัน",
    path: "/branch",
    homeTab: "day",
    icon: Store,
  },
];

export function accountById(id: string | null | undefined): Account | null {
  return accounts.find((account) => account.id === id) ?? null;
}
