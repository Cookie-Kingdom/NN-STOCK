import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  demoDb,
  editDecidedDb,
  linkedDb,
  unlinkedDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { EntryDetails } from "@/components/organisms/shared/EntryDetails";
import { entries, type Database, type Entry } from "@/lib/store";
import { accountById } from "@/lib/accounts";
import { branchNav, managerNav, ownerNav } from "@/lib/nav";
import { AppSidebar } from "./AppSidebar";
import { HistoryPanel } from "./HistoryPanel";

const meta: Meta = {
  title: "Organisms/Workspace/WorkspaceData",
  parameters: { db: demoDb },
};

export default meta;

/** Each account's menu, open on its first tab; only the Owner and Manager have badges. */
const sidebars = {
  owner: {
    nav: ownerNav,
    tab: "owner-dashboard",
    badges: { po: 2, invoices: 1 },
  },
  manager: {
    nav: managerNav,
    tab: managerNav[0].items[0].id,
    badges: { po: 2, invoices: 1 },
  },
  saladaeng: {
    nav: branchNav,
    tab: branchNav[0].items[0].id,
    badges: undefined,
  },
} as const;

/** Pick บัญชี in Controls: Owner (with PO and invoice badges), Account Manager (no
 *  dashboard) or ศาลาแดง. */
export const Sidebar: StoryObj<{ account: keyof typeof sidebars }> = {
  parameters: { layout: "fullscreen" },
  argTypes: {
    account: {
      name: "บัญชี",
      options: Object.keys(sidebars),
      control: {
        type: "radio",
        labels: {
          owner: "Owner",
          manager: "Account Manager",
          saladaeng: "ศาลาแดง",
        },
      },
    },
  },
  args: { account: "owner" },
  render: ({ account }) => (
    <div className="flex h-160">
      <AppSidebar
        account={accountById(account)!}
        nav={sidebars[account].nav}
        tab={sidebars[account].tab}
        onTab={fn()}
        badges={sidebars[account].badges}
      />
    </div>
  ),
};

const roleControl = {
  name: "ผู้ใช้",
  options: ["owner", "branch"],
  control: {
    type: "radio" as const,
    labels: { owner: "Owner", branch: "ศาลาแดง" },
  },
};
const hideSalesControl = {
  name: "ซ่อนยอดขาย (Account Manager)",
  control: "boolean" as const,
};

const historyData = pick("ข้อมูล", {
  ปกติ: demoDb,
  "ยังไม่ผูก Lot": unlinkedDb,
  ผูกแล้ว: linkedDb,
  คำขอแก้ไข: editDecidedDb,
});

/** Pick ข้อมูล, ผู้ใช้ and ซ่อนยอดขาย in Controls:
 *  - ปกติ: the Owner's full log, or ศาลาแดง's own entries plus, read-only, the Owner's
 *    allocations and transfers sent to it.
 *  - ยังไม่ผูก Lot (LNK-04/06/07): ศาลาแดง's receive, thaw and sale carry "ยังไม่ผูก Lot"
 *    and its material receipt "ไม่มีใบส่งวัสดุ"; expand one and press "ผูกกับ…".
 *  - ผูกแล้ว: the three meat entries read "ผูกแล้ว", show the batch by its PO number, and
 *    each `link` names its target ("รับของเข้าสาขา 9 ก.ย. · ศาลาแดง 10.00 กก."), never a
 *    raw id. Owner sees every link; ศาลาแดง its own.
 *  - คำขอแก้ไข: ศาลาแดง's requests above the log, "ขอแก้ไข" on its own entries.
 *  - ซ่อนยอดขาย: the Account Manager's log, sales without amounts and no edit button. */
export const History: StoryObj<{
  db: Database;
  role: "owner" | "branch";
  hideSales: boolean;
}> = {
  argTypes: {
    db: historyData.argType,
    role: roleControl,
    hideSales: hideSalesControl,
  },
  args: { db: historyData.initial, role: "owner", hideSales: false },
  render: ({ db, role, hideSales }) => (
    <HistoryPanel
      db={db}
      role={role}
      branch={role === "branch" ? "ศาลาแดง" : ""}
      hideSales={hideSales}
      onChanged={fn()}
    />
  ),
};

type Detail = { entry: Entry; db: Database };
const detail = pick<Detail>("รายการ", {
  ล่าสุด: { entry: demoDb.entries.at(-1)!, db: demoDb },
  "รับของ (มีใบจัดสรร)": {
    entry: demoDb.entries.find(
      (e) => e.kind === "receive" && e.values.allocation,
    )!,
    db: demoDb,
  },
  ขายที่แก้ไขแล้ว: {
    entry: entries(editDecidedDb, "sale")[0],
    db: editDecidedDb,
  },
});

/** Pick รายการ in Controls:
 *  - ล่าสุด: the log's last entry.
 *  - รับของ (มีใบจัดสรร): "ใบจัดสรร" reads as the allocation's date, branch and kg, not its
 *    id (LNK-07).
 *  - ขายที่แก้ไขแล้ว: badge "แก้ไขแล้ว", current values, and who asked, who approved, when.
 *  Toggle ยกเลิกแล้ว for a voided entry, เปิดรายละเอียด to start expanded. */
export const EntryDetail: StoryObj<{
  detail: Detail;
  voided: boolean;
  open: boolean;
  hideSales: boolean;
}> = {
  argTypes: {
    detail: detail.argType,
    voided: { name: "ยกเลิกแล้ว", control: "boolean" },
    open: { name: "เปิดรายละเอียด", control: "boolean" },
    hideSales: hideSalesControl,
  },
  args: { detail: detail.initial, voided: false, open: true, hideSales: false },
  render: ({ detail, voided, open, hideSales }) => (
    <EntryDetails
      key={`${detail.entry.id}:${open}`}
      entry={detail.entry}
      db={detail.db}
      role="owner"
      voided={voided}
      open={open}
      hideSales={hideSales}
      onChanged={fn()}
    />
  ),
};
