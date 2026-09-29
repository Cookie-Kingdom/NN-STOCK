import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { demoDb, linkedDb, unlinkedDb } from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { EntryDetails } from "@/components/organisms/shared/EntryDetails";
import type { Database } from "@/lib/store";
import { accountById } from "@/lib/accounts";
import { branchNav, ownerNav } from "@/lib/nav";
import { AppSidebar } from "./AppSidebar";
import { HistoryPanel } from "./HistoryPanel";

const db = demoDb;

const meta: Meta = {
  title: "Organisms/Workspace Data",
  parameters: { db },
};

export default meta;
type Story = StoryObj<{
  account: keyof typeof sidebars;
  role: "owner" | "branch";
  voided: boolean;
}>;

/** Each account's menu, open on its first tab; only the Owner has badges. */
const sidebars = {
  owner: {
    nav: ownerNav,
    tab: "owner-dashboard",
    badges: { po: 2, invoices: 1 },
  },
  saladaeng: {
    nav: branchNav,
    tab: branchNav[0].items[0].id,
    badges: undefined,
  },
} as const;

/** Pick บัญชี in Controls: Owner (with PO and invoice badges) or ศาลาแดง. */
export const Sidebar: Story = {
  parameters: { layout: "fullscreen" },
  argTypes: {
    account: {
      name: "บัญชี",
      options: Object.keys(sidebars),
      control: {
        type: "radio",
        labels: { owner: "Owner", saladaeng: "ศาลาแดง" },
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

/** Pick ผู้ใช้ in Controls: the Owner's full log, or ศาลาแดง's own entries. */
export const History: Story = {
  argTypes: {
    role: {
      name: "ผู้ใช้",
      options: ["owner", "branch"],
      control: {
        type: "radio",
        labels: { owner: "Owner", branch: "ศาลาแดง" },
      },
    },
  },
  args: { role: "owner" },
  render: ({ role }) => (
    <HistoryPanel
      db={db}
      role={role}
      branch={role === "branch" ? "ศาลาแดง" : ""}
      onChanged={fn()}
    />
  ),
};

const linkState = pick("สถานะ", {
  ยังไม่ผูก: unlinkedDb,
  ผูกแล้ว: linkedDb,
});

/** LNK-04/06/07: the log with entries recorded without their source. เลือกสถานะและผู้ใช้ใน Controls:
 *  - ยังไม่ผูก: ศาลาแดง's receive, thaw and sale carry "ยังไม่ผูก Lot" and its material
 *    receipt "ไม่มีใบส่งวัสดุ"; expand one and press "ผูกกับ…" to pick a batch or transfer.
 *  - ผูกแล้ว: the three meat entries read "ผูกแล้ว", show the batch by its PO number, and
 *    each `link` is in the log with its target named ("รับของเข้าสาขา 9 ก.ย. · ศาลาแดง
 *    10.00 กก."), never a raw id. Owner sees every link; ศาลาแดง its own. */
export const LinkHistory: StoryObj<{
  db: Database;
  role: "owner" | "branch";
}> = {
  argTypes: {
    db: linkState.argType,
    role: {
      name: "ผู้ใช้",
      options: ["branch", "owner"],
      control: {
        type: "radio",
        labels: { owner: "Owner", branch: "ศาลาแดง" },
      },
    },
  },
  args: { db: linkState.initial, role: "branch" },
  render: ({ db, role }) => (
    <HistoryPanel
      db={db}
      role={role}
      branch={role === "branch" ? "ศาลาแดง" : ""}
      onChanged={fn()}
    />
  ),
};

/** A branch receive that came in with an allocation: "ใบจัดสรร" reads as the allocation's
 *  date, branch and kg, not its id (LNK-07). */
export const EntryReferences: Story = {
  render: () => (
    <EntryDetails
      entry={db.entries.find(
        (e) => e.kind === "receive" && e.values.allocation,
      )!}
      db={db}
      role="owner"
      open
      onChanged={fn()}
    />
  ),
};

/** Toggle ยกเลิกแล้ว in Controls to show the entry as voided. */
export const EntryDetail: Story = {
  argTypes: { voided: { name: "ยกเลิกแล้ว", control: "boolean" } },
  args: { voided: false },
  render: ({ voided }) => (
    <EntryDetails
      entry={db.entries.at(-1)!}
      role="owner"
      voided={voided}
      onChanged={fn()}
    />
  ),
};
