import { Beef, Building2, Store } from "lucide-react";
import type { ActingRole } from "@/lib/store";
import type { Tab } from "@/lib/nav";

export type AccountId = "owner" | "saladaeng" | "minburi";

export type Account = {
  id: AccountId;
  role: ActingRole;
  /** Set only for branch accounts — the branch whose data this account may touch. */
  branch?: string;
  name: string;
  title: string;
  summary: string;
  path: string;
  homeTab: Tab;
  icon: typeof Beef;
};

const accounts: Account[] = [
  {
    id: "owner",
    role: "owner",
    name: "Owner",
    title: "เจ้าของร้าน",
    summary: "ดูสรุปของเดือน จดได้ทุกบันทึก และตั้งค่า",
    path: "/owner",
    homeTab: "overview",
    icon: Building2,
  },
  {
    id: "saladaeng",
    role: "branch",
    branch: "ศาลาแดง",
    name: "สาขาศาลาแดง",
    title: "ผู้ดูแลสาขา",
    summary: "จดยอดขาย รับเนื้อ และนับของคงเหลือของสาขา",
    path: "/branch",
    homeTab: "log",
    icon: Store,
  },
  {
    id: "minburi",
    role: "branch",
    branch: "มีนบุรี",
    name: "สาขามีนบุรี",
    title: "ผู้ดูแลสาขา",
    summary: "จดยอดขาย รับเนื้อ และนับของคงเหลือของสาขา",
    path: "/branch",
    homeTab: "log",
    icon: Store,
  },
];

export function accountById(id: string | null | undefined): Account | null {
  return accounts.find((account) => account.id === id) ?? null;
}
